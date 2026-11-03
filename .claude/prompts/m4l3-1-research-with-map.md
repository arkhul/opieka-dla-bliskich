/10x-research post-flow-analysis Przeanalizuj proces zapisu postów, zwracając szczególną uwagę na powiązane z nim obszary zdefiniowane w context/map/repo-map.md

Wykorzystaj trzech równoległych sub-agentów:

1. Śledzenie e2e: odtwórz ścieżkę od punktu wejścia, przez warstwy, do zapisu/odczytu
   i z powrotem. Daj sekwencję kroków z file:line oraz diagram Mermaid.
2. Luki w testach: które metody i gałęzie na tej ścieżce mają pokrycie,
   a które nie.
3. Zasięg oddziaływania: co musi zmienić się razem przy zmianie tego przepływu — szew
   interfejsu, warstwy generowane, model, migracje, testy. Połącz graf statyczny
   ze współzmianami z historii gita.

Skup się wyłącznie na analizie i opisie stanu obecnego repozytorium.

Twój raport musi zawierać dwie jawne i krytyczne sekcje:

1. Przegląd funkcjonalności
2. Dług techniczny

Oddziel dowody od interpretacji i białych plam.

Zapisz wnioski z badania do context/changes/post-flow-analysis/research.md