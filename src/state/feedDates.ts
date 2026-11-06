/** Preserve month precision: a month-only visit overlaps the selected calendar interval. */
export function visitInterval(value: string): [string,string] | null {
 const match=value.match(/^(\d{4})[-.](\d{2})(?:[-.](\d{2}))?/);
 if(!match)return null;
 const year=Number(match[1]), month=Number(match[2]);
 if(month<1||month>12)return null;
 const prefix=`${match[1]}-${match[2]}`;
 return match[3] ? [`${prefix}-${match[3]}`,`${prefix}-${match[3]}`] : [`${prefix}-01`,`${prefix}-${new Date(year,month,0).getDate()}`];
}
export function dateMatches(value:string,start:string,end:string):boolean {
 if(!start&&!end)return true;
 const interval=visitInterval(value);
 return Boolean(interval&&(!start||interval[1]>=start)&&(!end||interval[0]<=end));
}
