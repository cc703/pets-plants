const assert = require('assert');
const fs = require('fs');
const path = require('path');

const source = fs.readFileSync(path.join(__dirname, '..', 'app', 'points-shop.tsx'), 'utf8');

assert.match(source, /实物商城/, 'points shop must expose a separate real-goods mall entry');
assert.match(source, /即将上线/, 'real-goods mall entry must be marked as coming soon');
assert.match(source, /testID=["']real-goods-mall-entry["']/, 'real-goods mall entry needs a stable testID');
assert.match(source, /testID=["']real-goods-mall-modal["']/, 'real-goods mall modal needs a stable testID');
assert.match(source, /实物商品下单和支付能力正在开发中/, 'real-goods mall should explain the payment-development state');
assert.match(source, /兑换成功/, 'existing points redemption flow must remain intact');
assert.match(source, /available\?: boolean/, 'shop items need an availability boundary for future-only benefits');
assert.match(source, /item\.available === false/, 'future-only benefits must not enter the points deduction flow');
assert.match(source, /优惠券功能开发中/, 'future-only coupon benefits must explain their current limitation');

console.log('points shop contract check passed');
