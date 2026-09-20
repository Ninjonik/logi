**Tvrdenie:** Každý klasický jednopáskový Turingov stroj so vstupom z $\{0,1\}^*$ vieme simulovať Turingovým strojom s jednou diernou páskou.

**Idea:** Pôvodný obsah pásky nebudeme prepisovať. Po každom kroku vytvoríme na voľnej časti pásky nový zápis celej konfigurácie. Starý zápis použijeme iba na čítanie a dierami si označíme, ktoré jeho časti sme už spracovali.

Musíme pritom ukázať, že takéto kopírovanie zvládneme aj s jednou páskou a jednou hlavou.

**Dk.**

Nech $M$ je ľubovoľný klasický jednopáskový Turingov stroj. Zostrojíme stroj $D$ s diernou páskou, ktorý ho simuluje.

Konfiguráciou budeme rozumieť:

- obsah konečného úseku pásky obsahujúceho všetky neprázdne políčka aj hlavu,
- polohu hlavy,
- aktuálny stav stroja.

Políčka mimo zapísaného úseku považujeme za prázdne.

**1. Zakódovanie konfigurácie**

Každé políčko simulovanej pásky opíšeme jeho symbolom a prípadne aj stavom stroja, ak sa na ňom práve nachádza hlava.

Keďže $M$ má konečne veľa symbolov aj stavov, všetky takéto opisy vieme zakódovať binárnymi slovami rovnakej dĺžky $k\geq 1$.

Jeden opis uložíme na diernu pásku ako blok

$$
1\,m\,c_1c_2\cdots c_k\,1,
$$

kde:

- $c_1c_2\cdots c_k$ je zakódovaný opis políčka,
- $m=0$ znamená, že blok ešte nebol spracovaný,
- $m=*$ znamená, že blok už bol spracovaný.

Spracovanie teda označíme dovoleným prepísaním $0$ na $*$. Samotný opis políčka pritom zostane zachovaný.

Konfigurácie oddelíme dvojicou dier $**$. Na páske tak postupne vzniká zápis

$$
**\,C_0\,**\,C_1\,**\,C_2\,**\,\cdots
$$

Dvojica $**$ sa nemôže vyskytnúť vnútri konfigurácie: jediná možná diera v bloku je značka $m$ a z oboch strán susedí s bitom. Preto vieme oddeľovače jednoznačne rozpoznať.

**2. Spracovanie vstupu**

Na začiatku máme na páske obyčajné slovo $w\in\{0,1\}^*$.

Za vstupom necháme jednu medzeru, zapíšeme oddeľovač $**$ a za ním začneme zapisovať zakódovanú počiatočnú konfiguráciu $C_0$.

Vstup kopírujeme po jednom bite:

1. Nájdeme prvý ešte nespracovaný bit vstupu.
2. Zapamätáme si ho v konečnom riadení a jeho pôvodné políčko prepíšeme na $*$.
3. Presunieme sa na koniec vytváranej konfigurácie a zapíšeme zodpovedajúci blok.
4. Vrátime sa po ďalší bit.

Prvý vstupný bit označíme v jeho opise aj počiatočným stavom a prítomnosťou hlavy. Pre prázdny vstup vytvoríme jeden blok opisujúci prázdne políčko s hlavou v počiatočnom stave.

Pôvodný vstup tvorili iba nuly a jednotky, takže diery v ňom jednoznačne označujú už spracované bity. Medzera ponechaná za vstupom určuje jeho koniec. Celý postup preto vieme vykonať jednou hlavou.

Nakoniec dopíšeme oddeľovač $**$.

**3. Simulácia jedného kroku**

Predpokladajme, že už máme zapísanú konfiguráciu $C_t$. Za ňou vytvoríme konfiguráciu $C_{t+1}$.

Pri jednom kroku stroja $M$ sa:

- zmení symbol pod hlavou,
- zmení stav,
- hlava posunie najviac o jedno políčko.

Opis každého políčka v novej konfigurácii teda závisí iba od opisov troch pôvodných políčok: jeho ľavého suseda, jeho samotného a pravého suseda.

Tieto tri opisy majú pevnú dĺžku, takže ich stroj $D$ dokáže uchovať v konečnom riadení a určiť z nich nový opis.

Bloky starej konfigurácie spracujeme zľava doprava:

1. Nájdeme prvý blok so značkou $m=0$.
2. Prečítame jeho opis aj opisy susedov. Chýbajúceho suseda na kraji považujeme za prázdne políčko bez hlavy.
3. Určíme nový opis a značku spracovaného bloku prepíšeme na $*$.
4. Presunieme sa doprava na prvú voľnú medzeru a zapíšeme nový blok so značkou $m=0$.
5. Vrátime sa do starej konfigurácie a pokračujeme.

Návrat zvládneme pomocou oddeľovačov: pri pohybe doľava z rozpracovanej novej konfigurácie stretneme najprv pravý a potom ľavý oddeľovač starej konfigurácie. Odtiaľ hľadáme prvý nespracovaný blok.

Na každom konci novej konfigurácie navyše zapíšeme jedno nové políčko. Ľavé zapíšeme pred kopírovaním pôvodných blokov, pravé po ich skopírovaní. Ich opisy vypočítame rovnakým pravidlom, pričom políčka mimo pôvodného úseku boli prázdne. Tým pokryjeme aj prípad, keď hlava opustí pôvodne zapísaný úsek.

Po dokončení dopíšeme $**$. Nová konfigurácia je pripravená na ďalší krok.

**4. Správnosť simulácie**

Ukážeme indukciou podľa $t$, že $C_t$ opisuje konfiguráciu stroja $M$ po $t$ krokoch.

- Pre $t=0$ to platí podľa konštrukcie počiatočnej konfigurácie zo vstupu.
- Ak to platí pre $C_t$, tak pri vytváraní $C_{t+1}$ na každom políčku vykonáme presne zmenu určenú prechodovou funkciou $M$. Správne teda zapíšeme nový obsah pásky, polohu hlavy aj stav.

Tvrdenie preto platí pre každé $t$, pre ktoré výpočet stroja $M$ pokračuje.

Každý simulovaný krok trvá konečne veľa krokov stroja $D$, pretože spracúva konečne veľa blokov. Ak $M$ zastaví, $D$ rozpozná jeho koncový stav a tiež zastaví s rovnakým výsledkom. Prípadný binárny výstup môže ešte skopírovať do voľného úseku pásky. Ak $M$ nezastaví, simulácia pokračuje ďalej.

Počas celej konštrukcie používame iba:

- zápis do dosiaľ prázdnych políčok,
- prepísanie $0$ alebo $1$ na $*$.

Žiadnu dieru nemeníme. Všetky operácie sú teda na diernej páske dovolené.

Dostávame, že každý klasický jednopáskový Turingov stroj s binárnym vstupom vieme simulovať strojom s jednou diernou páskou. $\square$
