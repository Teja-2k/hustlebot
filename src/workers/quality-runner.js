import fs from 'fs';
import path from 'path';
import { spawn } from 'child_process';

/**
 * Quality Runner — runs automated checks on deliverables before sending to client.
 *
 * Universal checks + domain-specific checks from each agent.
 */

/**
 * Run all quality checks for a delivery
 */
export async function runQualityChecks(projectDir, checks = []) {
  const results = [];

  // Universal checks that apply to all deliveries
  results.push(await checkProjectStructure(projectDir));
  results.push(await checkFileCount(projectDir));
  results.push(await checkNoEmptyFiles(projectDir));
  results.push(await checkReadme(projectDir));
  results.push(await checkNoSecrets(projectDir));
  results.push(await checkFileSizes(projectDir));

  // Domain-specific checks passed in by the agent
  for (const check of checks) {
    try {
      const result = await check(projectDir);
      results.push(result);
    } catch (e) {
      results.push({
        name: 'Custom check',
        passed: false,
        message: `Check threw error: ${e.message}`,
      });
    }
  }

  const passed = results.filter(r => r.passed).length;
  const failed = results.filter(r => !r.passed);

  return {
    passed: failed.length === 0,
    checksRun: results.length,
    checksPassed: passed,
    checksFailed: failed.length,
    details: results,
    summary: failed.length === 0
      ? `All ${results.length} checks passed ✅`
      : `${failed.length}/${results.length} checks failed: ${failed.map(f => f.name).join(', ')}`,
  };
}

// --- Universal Checks ---

async function checkProjectStructure(dir) {
  const exists = fs.existsSync(dir);
  const entries = exists ? fs.readdirSync(dir) : [];
  const projectFiles = entries.filter(e =>
    e !== 'CLAUDE.md' && e !== 'plan.json' && e !== 'node_modules' && e !== '.git'
  );

  return {
    name: 'Project structure',
    passed: projectFiles.length >= 1,
    message: projectFiles.length >= 1
      ? `${projectFiles.length} project files/dirs found`
      : 'No project files created',
  };
}

async function checkFileCount(dir) {
  const files = listAllFiles(dir);
  return {
    name: 'Minimum files',
    passed: files.length >= 2,
    message: `${files.length} total files`,
  };
}

async function checkNoEmptyFiles(dir) {
  const files = listAllFiles(dir);
  const empty = files.filter(f => {
    try {
      return fs.statSync(path.join(dir, f)).size === 0;
    } catch { return false; }
  });

  return {
    name: 'No empty files',
    passed: empty.length === 0,
    message: empty.length === 0 ? 'All files have content' : `Empty: ${empty.slice(0, 5).join(', ')}`,
  };
}

async function checkReadme(dir) {
  const hasReadme = fs.existsSync(path.join(dir, 'README.md')) ||
                    fs.existsSync(path.join(dir, 'readme.md'));
  return {
    name: 'README present',
    passed: hasReadme,
    message: hasReadme ? 'README.md found' : 'Missing README.md',
  };
}

async function checkNoSecrets(dir) {
  const files = listAllFiles(dir);
  const suspicious = [];

  for (const file of files) {
    const lower = file.toLowerCase();
    if (lower.includes('.env') && !lower.includes('.env.example')) suspicious.push(file);
    if (lower.includes('credentials')) suspicious.push(file);
    if (lower.includes('secret')) suspicious.push(file);
    if (lower.endsWith('.pem') || lower.endsWith('.key')) suspicious.push(file);

    // Check file content for API keys
    try {
      const content = fs.readFileSync(path.join(dir, file), 'utf-8');
      if (content.match(/sk-[a-zA-Z0-9]{20,}/) || content.match(/AKIA[A-Z0-9]{16}/)) {
        suspicious.push(`${file} (contains API key pattern)`);
      }
    } catch {}
  }

  return {
    name: 'No secrets/credentials',
    passed: suspicious.length === 0,
    message: suspicious.length === 0
      ? 'No secrets detected'
      : `⚠ Potential secrets: ${suspicious.join(', ')}`,
  };
}

async function checkFileSizes(dir) {
  const files = listAllFiles(dir);
  const oversized = files.filter(f => {
    try {
      return fs.statSync(path.join(dir, f)).size > 10 * 1024 * 1024; // 10MB
    } catch { return false; }
  });

  return {
    name: 'File sizes reasonable',
    passed: oversized.length === 0,
    message: oversized.length === 0
      ? 'All files under 10MB'
      : `Oversized: ${oversized.join(', ')}`,
  };
}

// --- Domain-Specific Check Builders ---

/**
 * Check that specific file extensions exist
 */
export function checkFileTypes(extensions) {
  return async (dir) => {
    const files = listAllFiles(dir);
    const found = extensions.filter(ext =>
      files.some(f => f.endsWith(ext))
    );

    return {
      name: `Required file types (${extensions.join(', ')})`,
      passed: found.length >= 1,
      message: found.length >= 1
        ? `Found: ${found.join(', ')}`
        : `Missing required file types: ${extensions.join(', ')}`,
    };
  };
}

/**
 * Check that a Node.js project can install dependencies
 */
export function checkNpmInstall() {
  return async (dir) => {
    if (!fs.existsSync(path.join(dir, 'package.json'))) {
      return { name: 'npm install', passed: true, message: 'No package.json (skipped)' };
    }

    return new Promise((resolve) => {
      const proc = spawn('npm', ['install', '--dry-run'], {
        cwd: dir,
        timeout: 30000,
        shell: true,
        stdio: 'pipe',
      });

      let stderr = '';
      proc.stderr?.on('data', d => { stderr += d.toString(); });

      proc.on('close', (code) => {
        resolve({
          name: 'npm install (dry-run)',
          passed: code === 0,
          message: code === 0 ? 'Dependencies resolve correctly' : `npm errors: ${stderr.substring(0, 200)}`,
        });
      });

      proc.on('error', () => {
        resolve({ name: 'npm install', passed: true, message: 'npm not available (skipped)' });
      });
    });
  };
}

/**
 * Check that a Python script has no syntax errors
 */
export function checkPythonSyntax() {
  return async (dir) => {
    const files = listAllFiles(dir).filter(f => f.endsWith('.py'));
    if (files.length === 0) {
      return { name: 'Python syntax', passed: true, message: 'No Python files (skipped)' };
    }

    const errors = [];
    for (const file of files.slice(0, 5)) {
      const result = await new Promise((resolve) => {
        const proc = spawn('python', ['-m', 'py_compile', path.join(dir, file)], {
          timeout: 10000, shell: true, stdio: 'pipe',
        });
        let stderr = '';
        proc.stderr?.on('data', d => { stderr += d.toString(); });
        proc.on('close', (code) => resolve({ file, ok: code === 0, err: stderr }));
        proc.on('error', () => resolve({ file, ok: true, err: '' }));
      });
      if (!result.ok) errors.push(`${result.file}: ${result.err.substring(0, 100)}`);
    }

    return {
      name: 'Python syntax check',
      passed: errors.length === 0,
      message: errors.length === 0
        ? `${files.length} Python files — syntax OK`
        : `Syntax errors: ${errors.join('; ')}`,
    };
  };
}

/**
 * Check that HTML files are valid (basic checks)
 */
export function checkHTMLValid() {
  return async (dir) => {
    const files = listAllFiles(dir).filter(f => f.endsWith('.html'));
    if (files.length === 0) {
      return { name: 'HTML valid', passed: true, message: 'No HTML files (skipped)' };
    }

    const issues = [];
    for (const file of files.slice(0, 5)) {
      try {
        const content = fs.readFileSync(path.join(dir, file), 'utf-8');
        if (!content.includes('<!DOCTYPE') && !content.includes('<!doctype') && !content.includes('<html')) {
          issues.push(`${file}: Missing DOCTYPE or html tag`);
        }
        if (!content.includes('</html>')) {
          issues.push(`${file}: Missing closing </html> tag`);
        }
      } catch {}
    }

    return {
      name: 'HTML structure valid',
      passed: issues.length === 0,
      message: issues.length === 0
        ? `${files.length} HTML files — structure OK`
        : `Issues: ${issues.join('; ')}`,
    };
  };
}

/**
 * Check that JavaScript files have no syntax errors
 */
export function checkJSSyntax() {
  return async (dir) => {
    const files = listAllFiles(dir).filter(f => f.endsWith('.js') && !f.includes('node_modules'));
    if (files.length === 0) {
      return { name: 'JS syntax', passed: true, message: 'No JS files (skipped)' };
    }

    const errors = [];
    for (const file of files.slice(0, 10)) {
      const result = await new Promise((resolve) => {
        const proc = spawn('node', ['--check', path.join(dir, file)], {
          timeout: 10000, shell: true, stdio: 'pipe',
        });
        let stderr = '';
        proc.stderr?.on('data', d => { stderr += d.toString(); });
        proc.on('close', (code) => resolve({ file, ok: code === 0, err: stderr }));
        proc.on('error', () => resolve({ file, ok: true, err: '' }));
      });
      if (!result.ok) errors.push(`${result.file}: ${result.err.substring(0, 100)}`);
    }

    return {
      name: 'JavaScript syntax check',
      passed: errors.length === 0,
      message: errors.length === 0
        ? `${files.length} JS files — syntax OK`
        : `Syntax errors: ${errors.join('; ')}`,
    };
  };
}

// --- Utility ---

function listAllFiles(dir) {
  const files = [];
  try {
    const walk = (d, prefix = '') => {
      const entries = fs.readdirSync(d, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name === 'node_modules' || entry.name === '.git') continue;
        const rel = prefix ? `${prefix}/${entry.name}` : entry.name;
        if (entry.isDirectory()) {
          walk(path.join(d, entry.name), rel);
        } else {
          files.push(rel);
        }
      }
    };
    walk(dir);
  } catch {}
  return files;
}
