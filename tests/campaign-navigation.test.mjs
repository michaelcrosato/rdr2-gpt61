import test from 'node:test';
import assert from 'node:assert/strict';
import {blockedAt,followActor} from '../src/campaign-navigation.js';
import {RIVAL_WORLD as W} from '../content/campaign/bellwether-works.js';
test('Ruth clears the numerical timber-edge cell while real nearby collision remains blocked',()=>{
 const actor={x:1029.9999999999995,y:949.579082284279,z:72},start={...actor};
 for(let frame=0;frame<100;frame++){followActor(W,actor,{x:1120,y:1425,z:0},82,.05,5,9);assert.equal(blockedAt(W,actor.x,actor.y,9),false,'the actual actor remains outside the inflated timber');}
 assert.ok(Math.hypot(actor.x-start.x,actor.y-start.y)>100);assert.ok(actor.y>1002,'the original blocked edge no longer traps vertical route movement');
 assert.equal(blockedAt(W,1030,970,9),false);assert.equal(blockedAt(W,1030-1e-8,970,9),false,'only numerical edge noise is tolerated');
 for(const x of[1029.9999,1029.99,1029,1010])assert.equal(blockedAt(W,x,970,9),true,`meaningful penetration at ${x} stays blocked`);
});
