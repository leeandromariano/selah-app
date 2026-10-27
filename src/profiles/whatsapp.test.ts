import {describe,expect,it} from 'vitest'
import {normalizeWhatsApp} from './whatsapp'
import {profileFields} from './profile'
describe('formato WhatsApp sem comprovar titularidade',()=>{
 it('normaliza país, DDD e pontuação; aceita E.164 internacional',()=>{
  expect(normalizeWhatsApp('+55 (11) 99999-0000')).toBe('+5511999990000')
  expect(normalizeWhatsApp('+351 912 345 678')).toBe('+351912345678')
  expect(profileFields({name:null,phone:'+55 (11) 99999-0000',age_range:null,instagram:null}).phone).toBe('+5511999990000')
 })
 it.each(['','11999990000','5511999990000','+0123456789','+551234','+5501999990000','+55abc999990000','+5511999990000ext1','+1234567890123456'])('recusa formato inválido %s',value=>{
  expect(()=>normalizeWhatsApp(value)).toThrow('código do país')
 })
})
