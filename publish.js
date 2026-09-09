const fs = require('fs');
const { execSync } = require('child_process');

const SCRIPT_FILE = '刷课助手 - 稳定优化版.user.js';
const commitMsg = process.argv.slice(2).join(' ') || '自动同步脚本更新';

if (!fs.existsSync(SCRIPT_FILE)) {
  console.error('❌ 未找到脚本文件:', SCRIPT_FILE);
  process.exit(1);
}

let code = fs.readFileSync(SCRIPT_FILE, 'utf8');

// 匹配并自动递增 @version
const versionMatch = code.match(/(\/\/\s*@version\s+)(\d+)\.(\d+)\.(\d+)/);
if (!versionMatch) {
  console.error('❌ 未在脚本元数据中匹配到 @version');
  process.exit(1);
}

const prefix = versionMatch[1];
const major = parseInt(versionMatch[2], 10);
const minor = parseInt(versionMatch[3], 10);
const patch = parseInt(versionMatch[4], 10) + 1;
const newVersion = `${major}.${minor}.${patch}`;

code = code.replace(versionMatch[0], `${prefix}${newVersion}`);
fs.writeFileSync(SCRIPT_FILE, code, 'utf8');

// 同步更新 README.md 中的版本号徽章
if (fs.existsSync('README.md')) {
  let readme = fs.readFileSync('README.md', 'utf8');
  readme = readme.replace(/badge\/version-[0-9.]+-blue/g, `badge/version-${newVersion}-blue`);
  fs.writeFileSync('README.md', readme, 'utf8');
}

console.log(`\n📦 版本号已自动升级: ${versionMatch[2]}.${versionMatch[3]}.${versionMatch[4]} ➔ ${newVersion}`);

try {
  console.log('🚀 正在执行 Git 提交与远程推送...');
  execSync('git add .', { stdio: 'inherit' });
  execSync(`git commit -m "v${newVersion}: ${commitMsg}"`, { stdio: 'inherit' });
  execSync('git push', { stdio: 'inherit' });
  console.log(`\n🎉 发布成功！Mac 端油猴将在检测到版本 ${newVersion} 时自动静默更新。\n`);
} catch (err) {
  console.warn('\n⚠️ Git 推送遇到提示（可能是尚未配置远程仓库 git remote add origin ...）：');
  console.warn(err.message);
  console.log(`本地版本已成功更新为 v${newVersion} 并完成本地 commit。\n`);
}
