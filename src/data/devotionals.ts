export interface Devotional {
  id: number
  title: string
  reference: string
  verse: string
  summary: string
  reflection: string
  question: string
  theme: string
  date: string
  minutes: number
  color: string
}
export const devotionals: Devotional[] = [
  { id: 1, title: 'Confie no tempo de Deus', reference: 'Eclesiastes 3:1', verse: 'Tudo tem o seu tempo determinado, e há tempo para todo o propósito debaixo do céu.', summary: 'Nem tudo precisa acontecer agora. Há um propósito em cada estação e beleza em aprender a esperar.', reflection: 'Há dias em que a espera parece maior do que a nossa força. Olhamos para os planos que ainda não se realizaram e nos perguntamos se estamos no caminho certo. Nessas horas, a Palavra nos convida a respirar e reconhecer: a vida tem estações.\n\nConfiar no tempo de Deus significa fazer o que está ao nosso alcance com dedicação, sem tentar controlar cada resultado. O cuidado de Deus também se revela nos processos silenciosos, naquilo que amadurece devagar.\n\nHoje, dê um passo possível. Cultive a paciência, acolha o presente e lembre-se de que o seu valor não depende da velocidade das suas conquistas. Há graça suficiente para viver este dia.', question: 'O que você pode entregar a Deus hoje, em vez de tentar controlar?', theme: 'Confiança', date: '23 out, 2026', minutes: 5, color: 'lavender' },
  { id: 2, title: 'Paz em meio ao caminho', reference: 'João 14:27', verse: 'Deixo-vos a paz, a minha paz vos dou: não vo-la dou como o mundo a dá. Não se turbe o vosso coração, nem se atemorize.', summary: 'A presença de Deus é um lugar de descanso, mesmo quando a vida continua em movimento.', reflection: 'A paz que Jesus oferece encontra espaço na vida real, com seus compromissos e suas incertezas. Ela não exige que todas as perguntas tenham uma resposta.\n\nReserve uma pequena pausa. Respire com calma e fale com Deus sobre aquilo que pesa no seu coração. Permita-se receber cuidado e também procurar apoio nas pessoas em quem você confia.', question: 'Qual pequena pausa pode ajudar você a acolher a paz hoje?', theme: 'Paz', date: '22 out, 2026', minutes: 4, color: 'sage' },
  { id: 3, title: 'A esperança se renova', reference: 'Lamentações 3:22–23', verse: 'As misericórdias do Senhor são a causa de não sermos consumidos; porque as suas misericórdias não têm fim. Novas são cada manhã; grande é a tua fidelidade.', summary: 'Cada manhã é um convite para recomeçar com o coração cheio de esperança.', reflection: 'Um dia difícil não conta toda a sua história. As misericórdias de Deus nos lembram que há espaço para começar de novo, mesmo depois de tropeços e frustrações.\n\nRecomeçar pode ser simples: pedir perdão, retomar um hábito de cuidado ou oferecer uma palavra gentil. Que a esperança encontre lugar nas suas pequenas escolhas de hoje.', question: 'Que pequeno recomeço você deseja acolher nesta manhã?', theme: 'Esperança', date: '21 out, 2026', minutes: 3, color: 'peach' },
  { id: 4, title: 'O extraordinário no simples', reference: 'Salmos 118:24', verse: 'Este é o dia que fez o Senhor; regozijemo-nos, e alegremo-nos nele.', summary: 'Um olhar atento encontra motivos para agradecer nas pequenas coisas da vida.', reflection: 'Às vezes esperamos uma grande mudança para reconhecer o bem que já está perto. Um café compartilhado, uma conversa sincera, um instante de silêncio: o cotidiano também guarda presentes.\n\nA gratidão não apaga as dificuldades, mas amplia nosso olhar. Hoje, tente nomear três coisas pelas quais você pode agradecer e transforme essa percepção em um gesto de cuidado.', question: 'Quais três detalhes do seu dia merecem um agradecimento?', theme: 'Gratidão', date: '20 out, 2026', minutes: 4, color: 'lavender' },
]
