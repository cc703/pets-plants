const assert = require('assert');
const fs = require('fs');
const path = require('path');

const root = path.resolve(__dirname, '..');
const home = fs.readFileSync(path.join(root, 'app', '(tabs)', 'index.tsx'), 'utf8');
const ai = fs.readFileSync(path.join(root, 'app', '(tabs)', 'ai.tsx'), 'utf8');
const aiRoute = fs.readFileSync(path.join(root, 'server', 'routes', 'ai.js'), 'utf8');
const comingSoon = fs.readFileSync(path.join(root, 'src', 'components', 'ComingSoonModal.tsx'), 'utf8');

assert.match(home, /title: '已养宠'[\s\S]*?route: '\/pet'/, '已养宠入口应进入真实主宠档案');
assert.match(home, /云养宠功能正在开发中，敬请期待/, '云养宠入口必须明确提示开发中');
assert.match(home, /还没有主宠档案/, '首页主宠空状态不能再称为虚拟宠物');
assert.match(home, /ComingSoonModal/, '首页开发中能力必须使用跨端可见弹窗');
assert.doesNotMatch(home, /Alert\.alert/, '首页不能依赖 Web 端可能静默的 Alert.alert');

assert.match(ai, /拍照识别功能正在开发中，敬请期待/, '拍照识别未实现时必须提示开发中');
assert.match(ai, /语音问答功能正在开发中，敬请期待/, '语音问答未实现时必须提示开发中');
assert.doesNotMatch(ai, /useVoiceRecorder/, '未实现语音问答时不应启动本地录音伪流程');
assert.match(ai, /不提供用药剂量或诊断/, 'AI 页面必须展示健康风险边界');
assert.match(ai, /ComingSoonModal/, 'AI 开发中能力必须使用跨端可见弹窗');
assert.doesNotMatch(ai, /Alert\.alert/, 'AI 页面不能依赖 Web 端可能静默的 Alert.alert');

assert.match(comingSoon, /<Modal/, '开发中提示应使用原生 Modal 组件');
assert.match(comingSoon, /coming-soon-close-btn/, '开发中提示应提供可测试的关闭按钮');

assert.match(aiRoute, /不进行疾病确诊，不提供处方、药物剂量或停药建议/, '服务端提示必须限制诊断与用药建议');

console.log('product experience contract checks passed');
