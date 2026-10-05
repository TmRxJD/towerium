export function chooseBuildPerk(state,strategy='balanced'){
 const order=strategy==='economy'?[6,9,12,3,0,1,2]:strategy==='defense'?[1,2,4,7,8,11,14]:[0,3,5,4,6,7,1];
 return [...(state.perks?.offers??[])].sort((a,b)=>(order.includes(a)?order.indexOf(a):99)-(order.includes(b)?order.indexOf(b):99))[0];
}
