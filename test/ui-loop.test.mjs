import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createUISession, observedActions, decideUI } from '../src/ui-loop.mjs';
const state = body => 'Browser tab: 1, Title: "Test", URL: "https://example.com/".\n0 AXWebArea Test\n' + body;
function fixture(decisions, states) {
  let i=0, reads=0, clicks=[];
  const target={getAXState:async()=>states[Math.min(i,states.length-1)],click:async index=>{clicks.push(index);i++;}};
  const flow=createUISession(target,{scope:{kind:'browser',allowedOrigins:['https://example.com']},configure:async()=>{},decide:async()=>({choice:decisions[reads++],confidence:1})});
  return {flow,clicks};
}
test('multiple semantic UI actions run in one call with fresh indices and independent acceptance',async()=>{
  const {flow,clicks}=fixture(['a0','a0','DONE'],[state('1 button Reports'),state('8 button Details'),state('9 text Report details open')]);
  const r=await flow.run({goal:'Open report details',controls:[{op:'click',name:'Reports'},{op:'click',name:'Details'}],authorized:true});
  assert.equal(r.status,'NEEDS_VERIFICATION');assert.equal(r.verified,false);assert.deepEqual(clicks,[1,8]);assert.equal(r.metrics.decisions,3);
});
test('ambiguous and unseen controls are excluded, no generated indices',()=>{
  assert.deepEqual(observedActions(state('1 button Delete\n2 button Delete'),[{op:'click',name:'Delete'}]),[]);
  assert.deepEqual(observedActions(state('1 text Delete'),[{op:'click',name:'Delete'}]),[]);
});
test('browser scroll uses an observed page index and bounded distance',()=>{
  const actions=observedActions(state('8 text Article'),[{op:'scroll',direction:'down',pages:2}]);
  assert.equal(actions[0].index,0);assert.equal(actions[0].pages,2);
  assert.throws(()=>observedActions(state(''),[{op:'scroll',direction:'down',pages:99}]));
});
test('changed page causes handoff before click; no uncertain mutation replay',async()=>{
  let n=0,c=0;
  const flow=createUISession({getAXState:async()=>state(++n===1?'1 button Open':'2 button Changed'),click:async()=>c++},{scope:{kind:'browser',allowedOrigins:['https://example.com']},configure:async()=>{},decide:async()=>({choice:'a0',confidence:1})});
  assert.equal((await flow.run({goal:'Open panel',controls:[{op:'click',name:'Open'}],authorized:true})).status,'STALE_STATE');assert.equal(c,0);
  const failing=createUISession({getAXState:async()=>state('1 button Open'),click:async()=>{c++;throw Error('private');}},{scope:{kind:'browser',allowedOrigins:['https://example.com']},configure:async()=>{},decide:async()=>({choice:'a0',confidence:1})});
  const task={goal:'Open panel',controls:[{op:'click',name:'Open'}],authorized:true};
  assert.equal((await failing.run(task)).status,'ERROR_HANDOFF');assert.equal((await failing.run(task)).status,'SESSION_STOPPED');assert.equal(c,1);
});
test('scope, authorization, secrets and low confidence cannot approve actions',async()=>{
  let calls=0;
  const target={getAXState:async()=>state('1 button Open'),click:async()=>{throw Error('must not click');}};
  const options={scope:{kind:'browser',allowedOrigins:['https://other.test']},configure:async()=>{},decide:async()=>{calls++;return {choice:'a0',confidence:.8};}};
  const task={goal:'Open',controls:[{op:'click',name:'Open'}],authorized:true};
  assert.throws(()=>createUISession(target,{...options,minConfidence:NaN}));
  assert.throws(()=>createUISession(target,{...options,maxMs:NaN}));
  const flow=createUISession(target,options);
  await assert.rejects(flow.run({...task,authorized:false}));
  assert.equal((await flow.run(task)).status,'ERROR_HANDOFF');assert.equal(calls,0);
  const low=createUISession(target,{...options,scope:{kind:'browser',allowedOrigins:['https://example.com']}});
  assert.equal((await low.run(task)).status,'REVIEW_REQUIRED');
});
test('UI answer validation requires complete distribution and pinned model',async()=>{
  const input={goal:'Open',state:state('1 button Open'),actions:[{id:'a0',name:'Open'}],history:[]};
  const reply={model:'jev-1.13.0',truncated:false,coverage:{complete:true},answers:{next:{type:'choice',choice:'a0',confidence:1,probabilities:{a0:1,DONE:0,HANDOFF:0,BLOCKED:0}}}};
  assert.equal((await decideUI(input,{evaluate:async()=>reply})).choice,'a0');
  for(const mutate of [r=>r.model='jev-latest',r=>r.truncated=true,r=>r.answers.next.probabilities.DONE=.5,r=>delete r.answers.next.probabilities.BLOCKED]){
    const bad=structuredClone(reply);mutate(bad);await assert.rejects(decideUI(input,{evaluate:async()=>bad}));
  }
});
test('native adapter contract binds existing target, never invents OS app APIs',async()=>{
  let clicks=0;
  const target={getAXState:async()=>clicks?'0 window Test\n9 text Panel open':'0 window Test\n1 button Open',click:async()=>clicks++};
  let decision=0;
  const flow=createUISession(target,{scope:{kind:'native',boundByHost:true},configure:async()=>{},decide:async()=>({choice:decision++?'DONE':'a0',confidence:1})});
  assert.equal((await flow.run({goal:'Open panel',controls:[{op:'click',name:'Open'}],authorized:true})).status,'NEEDS_VERIFICATION');assert.equal(clicks,1);
});
