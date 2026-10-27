import { describe, expect, it, vi } from 'vitest'
import { ownerEnvironment, ownerOperationSql, parseOwnerArguments, runOwnerOperation } from '../../scripts/local-owner-tools.mjs'
const a='10000000-0000-4000-8000-000000000001',b='10000000-0000-4000-8000-000000000002'
const ref='LOCAL-fictional-reference-001'
describe('provisionamento local do OWNER por identidade explícita',()=>{
  it.each(['grant','revoke'])('exige ação, UUID e confirmação exata para %s',action=>{
    expect(parseOwnerArguments([action,a,'--confirm',a,'--audit-ref',ref])).toMatchObject({action,userId:a,auditRef:ref})
    for(const args of [[action,a],[action,a,'--confirm',b,'--audit-ref',ref],[action,'leitor_ficticio','--confirm',a,'--audit-ref',ref], [action,a,'--confirm',a,'--audit-ref',ref,'--confirm',a]])expect(()=>parseOwnerArguments(args)).toThrow()
  })
  it('transferência exige dois UUIDs diferentes confirmados e rejeita flags extras',()=>{
    const args=['transfer',a,b,'--confirm',a,'--confirm-target',b,'--audit-ref',ref]
    expect(parseOwnerArguments(args)).toMatchObject({action:'transfer',userId:a,nextId:b})
    for(const invalid of [args.slice(0,5),['transfer',a,a,'--confirm',a,'--confirm-target',a,'--audit-ref',ref],[...args,'--url','https://fiction.invalid']])expect(()=>parseOwnerArguments(invalid)).toThrow()
    expect(()=>parseOwnerArguments(['inspect',a,'--confirm',a])).toThrow()
  })
  it.each(["LOCAL-quote'unsafe",'personal@example.invalid','short','LOCAL-\nfiction-ref-001'])('recusa referência de auditoria inválida %j',audit=>{
    expect(()=>parseOwnerArguments(['grant',a,'--confirm',a,'--audit-ref',audit])).toThrow()
  })
  it('inspeção retorna somente verificações, sem promover nem retornar identidade',()=>{
    const request=parseOwnerArguments(['inspect',a]),sql=ownerOperationSql(request)
    expect(sql).toContain('begin read only;')
    expect(sql).not.toMatch(/insert into|delete from|update private/)
    const local={psql:vi.fn(()=> 'BEGIN\n'+JSON.stringify({exists:true,eligible:true,is_owner:false,owner_count:0,email:'private@example.invalid'})+'\nROLLBACK')}
    expect(runOwnerOperation(local,request)).toEqual({exists:true,eligible:true,is_owner:false,owner_count:0})
    expect(()=>runOwnerOperation({psql:()=> 'diagnostic'},request)).toThrow()
  })
  it('limite SQL revalida IDs, serializa concessões e mantém auditoria na mesma transação',()=>{
    expect(()=>ownerOperationSql({action:'grant',userId:"'unsafe",auditRef:ref})).toThrow()
    const sql=ownerOperationSql(parseOwnerArguments(['grant',a,'--confirm',a,'--audit-ref',ref]))
    expect(sql.indexOf('lock table private.app_owner')).toBeLessThan(sql.indexOf('insert into private.app_owner'))
    expect(sql.indexOf('insert into private.owner_provision_audit')).toBeLessThan(sql.lastIndexOf('commit;'))
    expect(sql).toContain('for share of u')
    expect(sql).toContain('email_confirmed_at is not null')
    expect(sql).not.toMatch(/(?:insert into|update|delete from) private.admin_users/)
  })
  it.each([
    {HTTPS_PROXY:'http://fiction.invalid'}, {ALL_PROXY:'socks5://fiction.invalid'},
    {SUPABASE_URL:'https://fiction.invalid'}, {VITE_DEV_SUPABASE_URL:'https://fiction.invalid'},
    {VITE_STAGING_SUPABASE_URL:'http://127.0.0.1:54321'}, {PROD_SUPABASE_URL:'https://fiction.invalid'},
    {SUPABASE_SERVICE_ROLE_KEY:'fiction'}, {SUPABASE_ACCESS_TOKEN:'fiction'}, {VITE_DEV_SUPABASE_ANON_KEY:'fiction'},
    {DATABASE_URL:'postgresql://postgres:fiction@127.0.0.1:54322/postgres'},
    {PGPASSWORD:'fiction'}, {PGPASSFILE:'fiction'}, {PGOPTIONS:'-c role=fiction'}, {NODE_OPTIONS:'--import=fiction'},
  ])('recusa credenciais/overrides sem abrir serviços (%j)',environment=>{
    expect(()=>ownerEnvironment(environment)).toThrow()
  })
  it('não encaminha credenciais arbitrárias a subprocessos nem lê arquivos .env',()=>{
    expect(ownerEnvironment({PATH:'fiction-path',UNKNOWN_SECRET:'fiction',SUPABASE_URL:'http://127.0.0.1:54321',VITE_DEV_SUPABASE_URL:'http://127.0.0.1:54321'})).toEqual({PATH:'fiction-path',SUPABASE_URL:'http://127.0.0.1:54321'})
  })
})
