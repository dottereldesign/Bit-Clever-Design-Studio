import test from 'node:test';
import assert from 'node:assert/strict';
import {budgetTotals,newBusinessRecord} from './businessData';
test('budget separates plans, active commitments, currencies and unknown prices',()=>{
 const cost=(amount:string,status:'planned'|'active'|'paused',frequency:'once'|'monthly'|'yearly',currency='NZD')=>({...newBusinessRecord('subscription',currency),amount,status,frequency});
 assert.deepEqual(budgetTotals([cost('120','active','yearly'),cost('20','active','monthly'),cost('400','planned','once'),cost('60','planned','yearly'),cost('1000','active','monthly','USD'),cost('999','paused','monthly'),cost('','planned','monthly'),{...newBusinessRecord('setup','NZD'),amount:'700'}],'NZD'),{upfront:400,activeMonthly:30,plannedMonthly:5,unpriced:1});
});
test('zero is a known cost and completed one-off purchases are not future spending',()=>{
 assert.deepEqual(budgetTotals([{...newBusinessRecord('purchase','NZD'),amount:'500',status:'done'},{...newBusinessRecord('hosting','NZD'),amount:'0',status:'active'}],'NZD'),{upfront:0,activeMonthly:0,plannedMonthly:0,unpriced:0});
});
