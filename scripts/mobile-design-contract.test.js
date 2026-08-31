const assert = require('assert');
const fs = require('fs');
const path = require('path');

const read = (relativePath) => fs.readFileSync(path.join(__dirname, '..', relativePath), 'utf8');
const theme = read('src/utils/theme.ts');
const tabs = read('app/(tabs)/_layout.tsx');
const webIcons = read('src/components/WebVectorIcons.tsx');

assert.match(theme, /primary:\s*'#4F8A69'/, 'primary color must use the approved botanical green');
assert.match(theme, /background:\s*'#F7F5EF'/, 'page background must use the approved warm neutral');
assert.match(theme, /accent:\s*'#E9876B'/, 'accent color must use the approved coral');
assert.match(theme, /text:\s*'#263238'/, 'primary text must use the approved neutral ink');

const visibleTabOrder = ['name="index"', 'name="wiki"', 'name="community"', 'name="ai"', 'name="profile"'];
let previousIndex = -1;
for (const tab of visibleTabOrder) {
  const currentIndex = tabs.indexOf(tab);
  assert.ok(currentIndex > previousIndex, `visible tab order must include ${tab} in the approved position`);
  previousIndex = currentIndex;
}

assert.match(tabs, /name="publish"[\s\S]*?href:\s*null/, 'publish must remain reachable by route but leave the primary tab bar');
assert.match(tabs, /name="ai"[\s\S]*?tabBarButtonTestID:\s*'tab-ai'/, 'AI advisor must be a visible primary tab');
assert.match(webIcons, /home:\s*'⌂'/, 'web home icon must use a recognizable symbol instead of a letter');
assert.match(webIcons, /book:\s*'▤'/, 'web encyclopedia icon must use a recognizable symbol instead of a letter');
assert.match(webIcons, /people:\s*'◌'/, 'web community icon must use a recognizable symbol instead of a letter');
assert.match(webIcons, /sparkles:\s*'✦'/, 'web AI icon must use a recognizable symbol instead of an asterisk');
assert.match(webIcons, /person:\s*'◎'/, 'web profile icon must use a recognizable symbol instead of a letter');

console.log('mobile design contract checks passed');
