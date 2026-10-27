export type OwnerRequest = {action:string;userId?:string;nextId?:string|null;auditRef?:string}
export function ownerEnvironment(environment?:Record<string,string|undefined>):Record<string,string>
export function openOwnerEnvironment(environment?:Record<string,string|undefined>):{psql(sql:string):string;[key:string]:unknown}
export function parseOwnerArguments(args:string[]):OwnerRequest
export function ownerOperationSql(request:OwnerRequest):string
export function runOwnerOperation(local:{psql(sql:string):string},request:OwnerRequest):{exists:boolean;eligible:boolean;is_owner:boolean;owner_count:number}|null
