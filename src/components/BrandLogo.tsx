// Logo do Coram (C com a chama) em PNG com fundo transparente. No tema claro usa a versão com o C escuro,
// porque o C creme sumiria no fundo claro; a escolha é feita por CSS, a partir de html[data-theme].
export function BrandLogo() {
  return <>
    <img className="logo-on-dark" src="/coram-logo.png" alt="" width="256" height="256" />
    <img className="logo-on-light" src="/coram-logo-light.png" alt="" width="256" height="256" />
  </>
}
