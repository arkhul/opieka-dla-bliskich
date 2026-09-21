---
project: "Opieka dla bliskich"
context_type: greenfield
created: 2026-09-20
updated: 2026-09-20
product_type: web-app
target_scale:
  users: medium
  qps: low
  data_volume: small
timeline_budget:
  mvp_weeks: 3
  hard_deadline: 2026-12-06
  after_hours_only: true
checkpoint:
  current_phase: 8
  phases_completed: [1, 2, 3, 4, 5, 6, 7]
  gray_areas_resolved:
    - topic: "kategoria bólu"
      decision: "narzut koordynacyjny + rozproszone i nieaktualne dane + paraliż decyzyjny"
    - topic: "wgląd"
      decision: "o dopasowaniu decyduje wolny termin i teren dojazdu; klasyczne ogłoszenia pokazują wyłącznie opis usług"
    - topic: "zakres głównej persony"
      decision: "rodzinny koordynator opieki — osoba organizująca opiekę dla krewnego, nie sam senior"
    - topic: "model dostępu"
      decision: "konto z logowaniem dla obu stron"
    - topic: "separacja ról"
      decision: "dwie role: koordynator i opiekun; bez administratora w pierwszej wersji"
    - topic: "zakres pierwszej wersji"
      decision: "zmniejszony; przyjęte cztery cięcia — prosta dostępność zamiast kalendarza, lista miejscowości zamiast promienia w km, przeglądanie z filtrem zamiast automatycznego kojarzenia, brak osobnego profilu koordynatora"
    - topic: "zgłoszenie potrzeby"
      decision: "wypada z pierwszej wersji; wraca razem z automatycznym dopasowaniem"
    - topic: "budżet czasu"
      decision: "3 tygodnie, około 30 godzin"
    - topic: "druga strona rynku"
      decision: "profil koordynatora i przeglądanie zgłoszeń przez opiekunów pozostają nice-to-have; MVP to jedna tablica"
    - topic: "jednostka terenu dojazdu"
      decision: "gmina zamiast miejscowości — krótsza lista do wypełnienia i mniejsze ryzyko odpadnięcia przez nazwę sąsiedniej wsi"
    - topic: "moment zakładania konta przez koordynatora"
      decision: "przeglądanie i filtrowanie bez logowania; konto potrzebne dopiero do odsłonięcia danych kontaktowych"
    - topic: "widoczność dla niezalogowanych"
      decision: "lista profili widoczna bez logowania, bez danych kontaktowych"
    - topic: "kryteria akceptacji US-01"
      decision: "pusty wynik z wyjaśnieniem; filtry łączone i zdejmowane pojedynczo; profil bez gminy nie trafia na listę"
    - topic: "reguła domenowa"
      decision: "punktowe dopasowanie profilu do potrzeby i ranking wyników; wybrane po ujawnieniu antywzorca pustego CRUD"
    - topic: "dopasowanie częściowe"
      decision: "gmina twardo odsiewa; brakujące usługi i terminy obniżają pozycję zamiast usuwać profil"
    - topic: "waga składników rankingu"
      decision: "pokrycie wymaganych usług waży najwięcej — grafik negocjuje się w rozmowie, kompetencji nie"
  frs_drafted: 16
  quality_check_status: accepted
---

## Vision & Problem Statement

Rodzinny koordynator opieki — córka organizująca stałą opiekę dla 80-letniej matki po wylewie — nie ma jednego miejsca, w którym zobaczy, kto realnie może pomóc i kiedy. Dziś przegląda grupy na Facebooku, dzwoni do urzędów i szpitali, jeździ samochodem na spotkania z kandydatami i obsługuje każdy kontakt osobno. Kosztuje ją to dużo czasu i nerwów, a zebrane informacje są rozproszone i szybko tracą aktualność. Nawet gdy uda się znaleźć kilku kandydatów, trudno ich porównać i zdecydować, komu powierzyć bliską osobę.

O dopasowaniu przesądza wolny termin i teren dojazdu, a klasyczne ogłoszenia pokazują wyłącznie opis usług — dostępności trzeba szukać telefonicznie. Stąd dziesiątki rozmów po to, by ustalić coś, co mogłoby być widoczne od razu.

Uwaga o skali: przy stukrotnie większym katalogu samo pokrycie potrzeby przestałoby różnicować profile — dziesiątki z nich pasowałyby w stu procentach, a ranking musiałby sięgnąć po reputację, weryfikację lub historię współpracy.

## User & Persona

**Rodzinny koordynator opieki** — osoba organizująca opiekę dla krewnego, nie sam senior.

- Rola: szuka opiekunów, weryfikuje ich i umawia w imieniu kogoś innego.
- Kontekst: bliska osoba wymaga stałej opieki po zdarzeniu medycznym (przykład źródłowy: 80 lat, po wylewie).
- Moment sięgnięcia po produkt: gdy trzeba zorganizować stałą opiekę i dotychczasowe kanały — znajomi, grupy na Facebooku, urzędy, szpitale — nie dają odpowiedzi, kto jest wolny.

### Secondary persona

**Opiekun oferujący usługi** — strona podażowa. Udostępnia dane kontaktowe, opis usług, teren dojazdu i wolne terminy. MVP służy przede wszystkim personie głównej; strona podażowa istnieje w zakresie potrzebnym, by koordynator miał kogo znaleźć.

## Success Criteria

### Primary

Pełny przepływ działa od początku do końca na wdrożonej wersji:

```
1. Opiekun rejestruje się i zakłada profil
   → dane kontaktowe, obsługiwane gminy, lista usług,
     prosta dostępność (dni tygodnia i pory dnia)
2. Koordynator przegląda opiekunów, filtrując po gminie
   i rodzaju usługi — bez logowania
3. Koordynator zakłada konto, żeby odsłonić dane kontaktowe
4. Koordynator otwiera profil i widzi dane kontaktowe
5. Dalszy kontakt i ustalenia odbywają się poza portalem
```

Koordynator, który zaczyna bez wiedzy o jakimkolwiek opiekunie, kończy sesję z danymi kontaktowymi co najmniej jednej osoby dopasowanej do gminy i rodzaju potrzebnej usługi — bez telefonów do urzędów i przeglądania grup.

### Secondary

- Koordynator dostaje powiadomienie, gdy w wybranej gminie pojawia się nowy profil opiekuna.

### Guardrails

- Dane kontaktowe obu stron nie są dostępne dla osób niezalogowanych ani dla wyszukiwarek.
- Portal pozostaje czystym pośrednikiem: bez płatności, umów i odpowiedzialności za przebieg usługi.
- Przeglądanie i filtrowanie listy działa bez odczuwalnej zwłoki przy realistycznej liczbie profili.

## User Stories

### US-01: Koordynator znajduje opiekuna dojeżdżającego do gminy osoby pod opieką

- **Given** koordynator oraz co najmniej jeden opiekun z uzupełnionym profilem
- **When** koordynator filtruje listę po gminie i rodzaju potrzebnej usługi, a następnie loguje się, aby odsłonić kontakt
- **Then** widzi profile spełniające oba warunki wraz z dostępnością, a po zalogowaniu również dane kontaktowe

#### Acceptance Criteria

- Brak dopasowań pokazuje komunikat wyjaśniający i podpowiedź, co zmienić w filtrach — nie pustą stronę z zerem wyników.
- Gmina, usługa i dostępność działają razem; zdjęcie jednego filtra nie kasuje pozostałych.
- Opiekun, który nie uzupełnił obsługiwanych gmin, nie pojawia się w wynikach.

## Functional Requirements

### Konto i dostęp

- FR-001: Opiekun może założyć konto i zalogować się. Priority: must-have
  > Socratic: Rozważono, że wymóg konta może odstraszyć stronę podażową i zostawić portal bez profili. Rozstrzygnięcie: zostaje bez zmian.
- FR-002: Koordynator może założyć konto i zalogować się. Priority: must-have
  > Socratic: Przyjęto kontrargument, że rejestracja stoi przed pierwszą wartością. Rozstrzygnięcie: zostaje, ale konto jest potrzebne dopiero do odsłonięcia danych kontaktowych — przeglądanie i filtrowanie działa bez logowania.

### Profil opiekuna

- FR-003: Opiekun może zobaczyć swój profil po zalogowaniu. Priority: must-have
  > Socratic: Rozważono, że podgląd i edycja to jeden ekran, a osobne wymaganie sugeruje pracę, której nie ma. Rozstrzygnięcie: zostaje bez zmian.
- FR-004: Opiekun może edytować swoje dane kontaktowe. Priority: must-have
  > Socratic: Rozważono, że swobodna podmiana numeru osłabia zaufanie przy usłudze dotyczącej osób zależnych. Rozstrzygnięcie: zostaje bez zmian.
- FR-005: Opiekun może edytować listę obsługiwanych gmin. Priority: must-have
  > Socratic: Przyjęto kontrargument, że gmina wypełnia się szybciej niż lista miejscowości i mniej osób odpada przez nazwę sąsiedniej wsi. Rozstrzygnięcie: jednostkę zmieniono z miejscowości na gminę.
- FR-006: Opiekun może edytować listę oferowanych usług. Priority: must-have
  > Socratic: Rozważono, że zamknięty słownik usług nigdy nie pokryje realnych potrzeb i że opis tekstowy niesie więcej. Rozstrzygnięcie: zostaje bez zmian.
- FR-007: Opiekun może edytować swoją dostępność w ujęciu dni tygodnia i pór dnia. Priority: must-have
  > Socratic: Rozważono, że dostępność szybko się dezaktualizuje i że przy stałej opiece właściwą jednostką jest okres od–do. Rozstrzygnięcie: zostaje bez zmian.

### Wyszukiwanie opiekunów

- FR-008: Koordynator może przeglądać listę profili opiekunów. Priority: must-have
  > Socratic: Przyjęto kontrargument, że sama lista bez filtrów powiela grupę na Facebooku. Rozstrzygnięcie: zostaje osobnym wymaganiem — lista jest powierzchnią, na której działają filtry, i pierwszym ekranem nowej osoby.
- FR-009: Koordynator może filtrować opiekunów po obsługiwanej gminie. Priority: must-have
  > Socratic: Rozważono, że filtr powinien dotyczyć miejsca pobytu osoby pod opieką, a nie miejscowości koordynatora, oraz że granice administracyjne mylą przy dojazdach. Rozstrzygnięcie: zostaje bez zmian; jednostka zmieniona na gminę wraz z FR-005.
- FR-010: Koordynator może filtrować opiekunów po rodzaju usługi. Priority: must-have
  > Socratic: Rozważono, że koordynator na początku drogi nie nazywa swojej potrzeby kategorią i filtr ukryje kogoś, kto by pomógł. Rozstrzygnięcie: zostaje bez zmian.
- FR-011: Koordynator może filtrować opiekunów po dostępności. Priority: must-have
  > Socratic: Rozważono, że filtr działa na danych, których nikt nie odświeża, więc może aktywnie wprowadzać w błąd. Rozstrzygnięcie: zostaje bez zmian.
- FR-012: Koordynator może zobaczyć dane kontaktowe opiekuna po zalogowaniu. Priority: must-have
  > Socratic: Rozważono, że jedna darmowa rejestracja otwiera wszystkie numery na portalu i że kontakt mógłby iść przez wiadomość w systemie. Rozstrzygnięcie: zostaje bez zmian.
- FR-016: Koordynator widzi wyniki uszeregowane według dopasowania do zgłoszonej potrzeby, z oznaczeniem, czego w danym profilu brakuje. Priority: must-have
  > Socratic: Rozważono, że ranking udaje obiektywność, licząc wyłącznie to, co ktoś wpisał w formularz, oraz że krzywdzi nowe i oszczędnie wypełnione profile. Rozstrzygnięcie: zostaje bez zmian.

### Druga strona rynku

- FR-013: Koordynator może zobaczyć i edytować własny profil z danymi kontaktowymi. Priority: nice-to-have
  > Socratic: Rozważono, że profil koordynatora bez zakładki dla opiekunów nie ma odbiorcy i zbiera dane bez powodu. Rozstrzygnięcie: zostaje jako nice-to-have.
- FR-014: Opiekun może przeglądać zgłoszenia koordynatorów szukających opieki. Priority: nice-to-have
  > Socratic: Rozważono, że to właśnie zgłoszenia rozwiązują problem pustego portalu i mogłyby zasługiwać na must-have. Rozstrzygnięcie: zostaje jako nice-to-have.
- FR-015: Koordynator może otrzymać powiadomienie o nowym profilu opiekuna w wybranej gminie. Priority: nice-to-have
  > Socratic: Rozważono, że koordynator szuka opieki teraz, a wysyłka powiadomień to osobna infrastruktura poza głównym przepływem. Rozstrzygnięcie: zostaje jako nice-to-have.

## Non-Functional Requirements

- Koordynator widzi wyniki filtrowania i rankingu w czasie poniżej 1 sekundy przy docelowej skali katalogu.
- Dane kontaktowe nie są dostępne osobom bez konta: nie pojawiają się w treści widocznej dla niezalogowanych ani w wynikach wyszukiwarek internetowych.
- Cały przepływ — od przeglądania z filtrami po odsłonięcie kontaktu — pozostaje w pełni używalny na ekranie telefonu.
- Opiekun może trwale usunąć swój profil wraz z danymi kontaktowymi; po usunięciu profil nie pojawia się w żadnych wynikach.

## Business Logic

Aplikacja ocenia każdy profil opiekuna względem potrzeby zgłoszonej przez koordynatora i szereguje wyniki od najlepiej dopasowanego, przy czym najwięcej waży pokrycie wymaganych usług.

Regułę zasila to, co koordynator wskazuje jako potrzebę — gmina, w której przebywa osoba pod opieką, potrzebne usługi oraz terminy, w których opieka jest wymagana — zestawione z tym, co opiekun zadeklarował w swoim profilu: obsługiwane gminy, oferowane usługi i dostępność w dniach tygodnia oraz porach dnia. W tej wersji koordynator wyraża potrzebę tymi samymi polami, których używa do filtrowania; nie ma osobnego formularza zgłoszenia.

Zgodność gminy jest warunkiem twardym: profil spoza wskazanej gminy nie trafia do wyników, bo dojazd jest ograniczeniem fizycznym. Pozostałe dwa wymiary działają miękko — brak części usług lub terminów obniża pozycję profilu, zamiast go usuwać. Największą wagę ma pokrycie wymaganych usług, ponieważ grafik negocjuje się w rozmowie, a zakresu kompetencji nie.

Koordynator spotyka regułę jako kolejność listy: na górze są profile najpełniej pokrywające potrzebę, a przy każdym widać, czego brakuje. Ranking jest domyślnym porządkiem wyników, a nie osobnym ekranem.

## Access Control

Model wielo­użytkownikowy: dostęp przez konto z logowaniem, dla obu stron. Dwie role, bez administratora w pierwszej wersji.

| Rola | Może |
|---|---|
| Opiekun | Zarządzać własnym profilem: dane kontaktowe, opis usług, obsługiwane gminy, dostępność |
| Koordynator | Przeglądać profile opiekunów i filtrować je po gminie oraz rodzaju usługi |

Dane kontaktowe drugiej strony są dostępne po zalogowaniu — portal kojarzy strony, a dalszy kontakt odbywa się poza nim.

Osoba niezalogowana widzi listę profili opiekunów i może ją filtrować, ale bez danych kontaktowych. Konto jest potrzebne dopiero w momencie odsłonięcia kontaktu.

## Non-Goals

- **Bez płatności i rozliczeń w portalu** — pieniądze ustalają strony między sobą; utrwala model czystego pośrednika i trzyma poza zakresem konsekwencje prawne rozliczeń.
- **Bez kalendarza rezerwacyjnego** — dostępność jest informacją, a nie zobowiązaniem; rezerwowanie i blokowanie terminów to osobny projekt.
- **Bez weryfikacji i moderacji opiekunów** — portal nie sprawdza dokumentów ani referencji; ocena wiarygodności należy do koordynatora.
- **Bez wiadomości wewnątrz portalu** — kontakt odbywa się telefonem lub mailem poza systemem; skrzynka i ślad rozmowy pozostają poza zakresem.

## Open Questions

1. **Potwierdzanie rejestracji** — czy założenie konta wymaga potwierdzenia adresu e-mail? Owner: użytkownik.
