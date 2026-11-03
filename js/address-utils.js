/* Shared Jasper Fire Department address normalization. Source/display addresses remain unchanged. */
(function(){
  const aliases={east:"e",west:"w",north:"n",south:"s",highway:"hwy",street:"st",road:"rd",avenue:"ave",drive:"dr",lane:"ln",boulevard:"blvd",court:"ct",circle:"cir",trail:"trl",terrace:"ter",parkway:"pkwy",place:"pl",turnpike:"tpke",route:"rte"};
  const dirs=new Set(["n","s","e","w","ne","nw","se","sw"]);
  function normalize(value){
    let tokens=String(value??"").split(",")[0].toLowerCase()
      .replace(/\b(north\s+east|north-east)\b/g,"ne").replace(/\b(north\s+west|north-west)\b/g,"nw")
      .replace(/\b(south\s+east|south-east)\b/g,"se").replace(/\b(south\s+west|south-west)\b/g,"sw")
      .replace(/[^a-z0-9]+/g," ").trim().split(/\s+/).filter(Boolean).map(t=>aliases[t]||t);
    const direction=tokens.filter(t=>dirs.has(t)).sort().join("");
    tokens=tokens.filter(t=>!dirs.has(t));
    if(direction)tokens.push(direction);
    return tokens.join("");
  }
  function normalizeSearch(value){
    return String(value??"").toLowerCase()
      .replace(/\b(highway|street|road|avenue|drive|lane|boulevard|court|circle|trail|terrace|parkway|place|turnpike|route)\b/g,m=>aliases[m])
      .replace(/\b(east|west|north|south)\b/g,m=>aliases[m])
      .replace(/[^a-z0-9]+/g," ").trim();
  }
  window.jfdNormalizeAddress=normalize;
  window.jfdAddressMatches=(a,b)=>!!normalize(a)&&normalize(a)===normalize(b);
  window.jfdNormalizeSearchText=normalizeSearch;
})();