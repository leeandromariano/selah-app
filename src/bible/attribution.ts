// Keep the copyright notice while removing the separate promotional introduction.
export function displayAttribution(value: string) {
  return value.replace(/^A Sociedade Bíblica do Brasil tem a missão de semear a Palavra que transforma vidas, tornando-a relevante para as pessoas\. Junte-se a nós!\s*/u, '')
}
