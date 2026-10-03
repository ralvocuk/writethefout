/**
 * Türkçede sık yapılan yazım yanlışları → TDK'ye göre doğru yazım.
 * Hunspell'in öneri sırası her zaman en olası kelimeyi başa koymaz ("yanlız" için "yalız");
 * bu listedeki kelimelerde doğru biçim ilk öneri olur. Boşluklu doğrular (her şey) de buradan gelir.
 */
export const COMMON_TR: Record<string, string> = {
  yanlız: 'yalnız',
  yanlızca: 'yalnızca',
  yanlızlık: 'yalnızlık',
  yalınız: 'yalnız',
  yalnış: 'yanlış',
  yalnışlık: 'yanlışlık',
  herkez: 'herkes',
  herkeze: 'herkese',
  herşey: 'her şey',
  herşeyi: 'her şeyi',
  herşeyin: 'her şeyin',
  birşey: 'bir şey',
  birsey: 'bir şey',
  hersey: 'her şey',
  hicbirsey: 'hiçbir şey',
  birşeyi: 'bir şeyi',
  birşeyler: 'bir şeyler',
  hiçbirşey: 'hiçbir şey',
  hiçkimse: 'hiç kimse',
  birsürü: 'bir sürü',
  hergün: 'her gün',
  herzaman: 'her zaman',
  birgün: 'bir gün',
  birkere: 'bir kere',
  birdaha: 'bir daha',
  şuan: 'şu an',
  tabiki: 'tabii ki',
  tabiiki: 'tabii ki',
  malesef: 'maalesef',
  inşaalah: 'inşallah',
  orjinal: 'orijinal',
  eşortman: 'eşofman',
  süpriz: 'sürpriz',
  şarz: 'şarj',
  ünvan: 'unvan',
  entellektüel: 'entelektüel',
  pantalon: 'pantolon',
  meyva: 'meyve',
  seyehat: 'seyahat',
  şöför: 'şoför',
  kuafür: 'kuaför',
  mütevazi: 'mütevazı',
  ahçı: 'aşçı',
  aşcı: 'aşçı',
  kiprik: 'kirpik',
  eşkal: 'eşkâl',
  eşgal: 'eşkâl',
  traş: 'tıraş',
  tirbüşon: 'tirbuşon',
  laboratuar: 'laboratuvar',
  kollektif: 'kolektif',
  profösör: 'profesör',
  eksoz: 'egzoz',
  egsoz: 'egzoz',
  egzos: 'egzoz',
  sandoviç: 'sandviç',
  sandiviç: 'sandviç',
  poaça: 'poğaça',
  pohaça: 'poğaça',
  rasgele: 'rastgele',
  deyil: 'değil',
  diil: 'değil',
  sarmısak: 'sarımsak',
  kirbit: 'kibrit',
  metod: 'metot',
  kontür: 'kontör',
  aksesuvar: 'aksesuar',
  antreman: 'antrenman',
  antranman: 'antrenman',
  espiri: 'espri',
  mönü: 'menü',
  çukulata: 'çikolata',
  klavuz: 'kılavuz',
  proğram: 'program',
  dinazor: 'dinozor',
  küsür: 'küsur',
  tiren: 'tren',
  kıral: 'kral',
  hakkaten: 'hakikaten',
  haketmek: 'hak etmek',
  bilimum: 'bilumum',
  televüzyon: 'televizyon',
  döküman: 'doküman',
  dökümantasyon: 'dokümantasyon',
  eşşek: 'eşek',
  ilkönce: 'ilk önce',
  heralde: 'herhâlde',
  yanyana: 'yan yana',
  yavaşyavaş: 'yavaş yavaş',
  arasıra: 'ara sıra',
  birbuçuk: 'bir buçuk',
  sağolun: 'sağ olun',
  sağol: 'sağ ol',
  hoşçakal: 'hoşça kal',
  hoşgeldin: 'hoş geldin',
  hoşgeldiniz: 'hoş geldiniz',
  yapıcam: 'yapacağım',
  gelicem: 'geleceğim',
  gidicem: 'gideceğim',
  edicem: 'edeceğim',
  diycem: 'diyeceğim',
  ediyim: 'edeyim',
  geliyim: 'geleyim',
  napıyorsun: 'ne yapıyorsun',
};

// kendine eşlenen (doğru) kayıtlar yanlışlıkla eklenmesin
for (const [k, v] of Object.entries(COMMON_TR)) if (k === v) delete COMMON_TR[k];

/** Damerau–Levenshtein uzaklığı (yer değiştirme 1 sayılır) */
export function editDistance(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  const d: number[][] = Array.from({ length: m + 1 }, (_, i) => [i, ...Array(n).fill(0)]);
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++) {
      const c = a[i - 1] === b[j - 1] ? 0 : 1;
      d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + c);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1]) d[i][j] = Math.min(d[i][j], d[i - 2][j - 2] + 1);
    }
  return d[m][n];
}
