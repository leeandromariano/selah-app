export type Book = { id: string; name: string; chapters: number; testament: 'Antigo Testamento' | 'Novo Testamento' }

// Canonical Protestant ordering and chapter counts; identifiers are URL-safe.
const old = [
  ['genesis','Gênesis',50],['exodo','Êxodo',40],['levitico','Levítico',27],['numeros','Números',36],['deuteronomio','Deuteronômio',34],
  ['josue','Josué',24],['juizes','Juízes',21],['rute','Rute',4],['1-samuel','1 Samuel',31],['2-samuel','2 Samuel',24],
  ['1-reis','1 Reis',22],['2-reis','2 Reis',25],['1-cronicas','1 Crônicas',29],['2-cronicas','2 Crônicas',36],['esdras','Esdras',10],
  ['neemias','Neemias',13],['ester','Ester',10],['jo','Jó',42],['salmos','Salmos',150],['proverbios','Provérbios',31],
  ['eclesiastes','Eclesiastes',12],['cantares','Cantares',8],['isaias','Isaías',66],['jeremias','Jeremias',52],['lamentacoes','Lamentações',5],
  ['ezequiel','Ezequiel',48],['daniel','Daniel',12],['oseias','Oseias',14],['joel','Joel',3],['amos','Amós',9],['obadias','Obadias',1],
  ['jonas','Jonas',4],['miqueias','Miqueias',7],['naum','Naum',3],['habacuque','Habacuque',3],['sofonias','Sofonias',3],['ageu','Ageu',2],
  ['zacarias','Zacarias',14],['malaquias','Malaquias',4],
] as const
const newer = [
  ['mateus','Mateus',28],['marcos','Marcos',16],['lucas','Lucas',24],['joao','João',21],['atos','Atos',28],['romanos','Romanos',16],
  ['1-corintios','1 Coríntios',16],['2-corintios','2 Coríntios',13],['galatas','Gálatas',6],['efesios','Efésios',6],['filipenses','Filipenses',4],
  ['colossenses','Colossenses',4],['1-tessalonicenses','1 Tessalonicenses',5],['2-tessalonicenses','2 Tessalonicenses',3],
  ['1-timoteo','1 Timóteo',6],['2-timoteo','2 Timóteo',4],['tito','Tito',3],['filemom','Filemom',1],['hebreus','Hebreus',13],
  ['tiago','Tiago',5],['1-pedro','1 Pedro',5],['2-pedro','2 Pedro',3],['1-joao','1 João',5],['2-joao','2 João',1],['3-joao','3 João',1],
  ['judas','Judas',1],['apocalipse','Apocalipse',22],
] as const
export const books: Book[] = [
  ...old.map(([id,name,chapters]) => ({ id,name,chapters,testament: 'Antigo Testamento' as const })),
  ...newer.map(([id,name,chapters]) => ({ id,name,chapters,testament: 'Novo Testamento' as const })),
]
// API.Bible book IDs in the same canonical order as books.
export const apiBookIds = 'GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV'.split(' ')
export type Location = { translation: string; book: string; chapter: number; verse?: number; endVerse?: number }
export function bookById(id: string) { return books.find(book => book.id === id) }
export function adjacent(bookId: string, chapter: number, direction: -1 | 1) {
  const index = books.findIndex(book => book.id === bookId), book = books[index]
  if (!book || !Number.isInteger(chapter) || chapter < 1 || chapter > book.chapters) return null
  const next = chapter + direction
  if (next >= 1 && next <= book.chapters) return { book: book.id, chapter: next }
  const neighbor = books[index + direction]
  return neighbor ? { book: neighbor.id, chapter: direction === 1 ? 1 : neighbor.chapters } : null
}
// Preserve accents: "Jo" could mean João, whereas "Jó" is a distinct book.
const normalize = (value: string) => value.toLocaleLowerCase('pt-BR').replace(/\s+/g, ' ').trim()
export function parseReference(value: string): Omit<Location, 'translation'> | null {
  const match = value.trim().match(/^(.+?)\s+(\d{1,3})(?:(?::|\s+)(\d{1,3})(?:\s*[-–]\s*(\d{1,3}))?)?$/u)
  if (!match) return null
  const book = books.find(item => normalize(item.name) === normalize(match[1]))
  const chapter = Number(match[2]), verse = match[3] ? Number(match[3]) : undefined, endVerse = match[4] ? Number(match[4]) : undefined
  if (!book || chapter < 1 || chapter > book.chapters || (verse !== undefined && verse < 1) || (endVerse !== undefined && (verse === undefined || endVerse < verse))) return null
  return { book: book.id, chapter, verse, endVerse }
}
export function bibleHash(location: Location) {
  const suffix = location.verse ? `/${location.verse}${location.endVerse ? '-' + location.endVerse : ''}` : ''
  return `#biblia/${location.translation}/${location.book}/${location.chapter}${suffix}`
}
export function parseBibleRoute(page: string): Location | null {
  const match = /^biblia\/([a-z0-9-]+)\/([a-z0-9-]+)\/([1-9]\d{0,2})(?:\/([1-9]\d{0,2})(?:-([1-9]\d{0,2}))?)?$/.exec(page)
  if (!match) return null
  const book = bookById(match[2]), chapter = Number(match[3]), verse = match[4] ? Number(match[4]) : undefined, endVerse = match[5] ? Number(match[5]) : undefined
  if (!book || chapter > book.chapters || (endVerse !== undefined && (verse === undefined || endVerse < verse))) return null
  return { translation: match[1], book: book.id, chapter, verse, endVerse }
}
