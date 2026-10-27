export function normalizeWhatsApp(input: string) {
  const number = input.trim().replace(/[ ().-]/g, '')
  if (!/^\+[1-9][0-9]{7,14}$/.test(number) || (number.startsWith('+55') && !/^\+55[1-9]{2}9[0-9]{8}$/.test(number))) throw new Error('Informe WhatsApp com +código do país e DDD, por exemplo +55 11 99999-0000. O formato não comprova titularidade.')
  return number
}
