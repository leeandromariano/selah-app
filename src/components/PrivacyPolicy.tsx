import { Heading } from './UI'
export function PrivacyPolicy() {
  return <article className="reading">
    <Heading eyebrow="TRANSPARÊNCIA" title="Privacidade no Selah" description="Informações para o ambiente local de testes. Use somente dados fictícios." />
    <h2>Conta e histórico pessoal</h2>
    <p>O cadastro usa username, e-mail, senha e WhatsApp. Nome pessoal e Instagram são opcionais. Aberturas ficam no histórico pessoal e não comprovam conclusão. O perfil permite corrigir campos editáveis e registrar um pedido de exclusão para análise manual; esse pedido não apaga a conta automaticamente.</p>
    <h2>Conclusões e consistência</h2>
    <p>Conclusões voluntárias geram métricas individuais: ofensiva atual, maior sequência histórica, total de dias com conclusão e situação de hoje. O proprietário do Selah (OWNER) pode consultar esses indicadores associados ao username de todos os leitores cadastrados para gestão, acompanhamento e incentivo ao uso, inclusive conversas voluntárias.</p>
    <p>O ranking é administrativo, não público. Outros leitores e futuros publicadores convidados (PUBLISHER) não têm acesso ao ranking ou às métricas de terceiros. Cada leitor consulta suas próprias métricas e seu calendário. O painel do proprietário não mostra e-mail, telefone, textos lidos, segundos ou histórico detalhado de aberturas e conclusões.</p>
    <h2>WhatsApp e feedback</h2>
    <p>O WhatsApp é um dado separado, solicitado para possibilitar pedidos individuais de feedback quando autorizados. A autorização de contato é opcional e pode ser retirada em Meu perfil. Ela não será reutilizada como base para acesso às métricas de consistência. Não há envio automático de mensagens nem consentimento separado para o ranking administrativo.</p>
    <h2>Antes da abertura ao público</h2>
    <p>Este aviso descreve o funcionamento local e não afirma conformidade integral com a legislação de privacidade. Antes de disponibilizar o aplicativo ao público, o responsável precisa avaliar a base aplicável ao tratamento, retenção e exclusão, atendimento de direitos, comunicação a contas existentes e proteção dos indicadores de hábitos religiosos.</p>
    <p>O uso por menores de idade exige avaliação adicional sobre público etário, proteção apropriada, participação de responsáveis quando aplicável e limites de acompanhamento e contato. Esses pontos e o atendimento operacional de privacidade permanecem pendentes de definição.</p>
    <a className="text-link" href="#cadastro">Voltar ao cadastro</a>
  </article>
}
