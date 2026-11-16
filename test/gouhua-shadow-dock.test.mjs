import test from 'node:test';
import assert from 'node:assert/strict';
import { holdTarget, placeTarget, releaseTarget, fingerprint, targetKey, findTarget } from '../src/dock-targets.js';

function target(shadow) {
    const values = new Map([['left', ['12px','']], ['top', ['20px','']], ['--plugin-state', ['keep','']]]);
    const controlValues = new Map([['opacity', ['.4','']]]);
    const style = map => ({ getPropertyValue:k=>map.get(k)?.[0]||'', getPropertyPriority:k=>map.get(k)?.[1]||'', setProperty:(k,v,p='')=>map.set(k,[v,p]),removeProperty:k=>map.delete(k) });
    const styles=[];
    const root={append(node){node.isConnected=true;styles.push(node);},querySelector:()=>control};
    const control={matches:s=>!shadow && s==='#sp-fab > .sp-fab-btn',style:style(controlValues)};
    const doc={head:root,createElement:()=>({isConnected:false,remove(){this.isConnected=false;}})};
    const element={id:'sp-fab',shadowRoot:shadow?root:null,ownerDocument:doc,style:style(values),matches:()=>false,querySelector:()=>control,closest:()=>null,getAttribute:()=>'',getBoundingClientRect:()=>({width:36,height:36}),classList:[]};
    return {element,control,values,controlValues,styles,root};
}

test('构画Shadow与旧Light入口保持id指纹，收纳只临时接管命中，移出恢复原球样式',()=>{
    for(const shadow of [true,false]) {
        const f=target(shadow);const mark=fingerprint(f.element);
        assert.equal(targetKey(mark),'id:sp-fab');assert.equal(findTarget(mark,{getElementById:()=>f.element}),f.element);
        const binding=holdTarget(f.element);assert.equal(binding.control,f.control);assert.equal(binding.width,36);
        assert.ok(binding.collectedStyle,'new Shadow and legacy Light both need a scoped collected style');
        assert.equal(f.styles.length,1);assert.match(binding.collectedStyle.textContent,/pointer-events:none!important/);
        placeTarget(binding,{left:100,top:200,width:36,height:36},true);
        assert.deepEqual(f.values.get('pointer-events'),['none','important']);assert.deepEqual(f.controlValues.get('opacity'),['1','important']);
        releaseTarget(binding);assert.equal(binding.collectedStyle.isConnected,false);
        assert.deepEqual(f.values.get('left'),['12px','']);assert.deepEqual(f.values.get('top'),['20px','']);
        assert.equal(f.values.has('pointer-events'),false);assert.equal(f.values.has('scale'),false);
        assert.deepEqual(f.values.get('--plugin-state'),['keep','']);assert.deepEqual(f.controlValues.get('opacity'),['.4','']);
    }
});
