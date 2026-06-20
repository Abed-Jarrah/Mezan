(function(global){
  const categories=new Set(['food','transport','bills','fun','other']);
  function jsonFromText(text){
    if(typeof text!=='string')return null;
    const fenced=text.match(/```json\s*([\s\S]*?)\s*```/i);
    const candidate=fenced?.[1]||text.match(/\{[\s\S]*\}/)?.[0];
    if(!candidate)return null;
    try{return JSON.parse(candidate)}catch{return null}
  }
  function parseExpenseProposal(text,{number,today,validDate,classify}={}){
    const raw=jsonFromText(text);
    if(!raw||raw.action!=='add_expense')return null;
    const amount=typeof number==='function'?number(raw.amount):Number(raw.amount);
    if(!Number.isFinite(amount)||amount<=0)return null;
    const merchant=typeof raw.merchant==='string'?raw.merchant.trim().slice(0,100):'';
    let category=typeof raw.category==='string'?raw.category.trim().toLowerCase():'';
    if(!categories.has(category))category=typeof classify==='function'?classify(merchant):'other';
    if(!categories.has(category))category='other';
    const date=typeof raw.date==='string'?raw.date.trim():'';
    const valid=date&&/^\d{4}-\d{2}-\d{2}$/.test(date)&&typeof validDate==='function'&&validDate(date);
    return {amount,merchant,category,date:valid?date:today};
  }
  global.MezanChat={...(global.MezanChat||{}),parseExpenseProposal};
})(globalThis);
