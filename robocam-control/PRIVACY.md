# Zásady ochrany soukromí – Arnošt RoboCam Bridge

**Poslední aktualizace: 11. září 2026**

Arnošt RoboCam Bridge je rozšíření pro Chrome určené k monitoringu a ovládání SlidesLive RoboCam Control Roomu během živé produkce.

## Jaká data rozšíření zpracovává

Rozšíření může lokálně zpracovávat:

- URL a názvy otevřených karet potřebné k nalezení RoboCam Control Roomu a souvisejících oken,
- obsah kompatibilních SlidesLive/RoboCam stránek potřebný k zobrazení stavů sálů, kamer, nahrávání a dalších ovládacích prvků,
- uživatelská nastavení, stav rozšíření, seznam sálů a cache eventového programu.

Tato data jsou používána pouze pro funkce rozšíření a nejsou používána ke sledování běžné aktivity uživatele na webu.

## Ukládání dat

Nastavení a provozní stav jsou ukládány lokálně v prohlížeči prostřednictvím Chrome Storage. Rozšíření neodesílá tato data vývojáři za účelem profilování, reklamy ani analytického sledování uživatele.

## Vzdálené zdroje

Rozšíření může přes HTTPS načítat vzdálenou konfiguraci a data eventového programu. Vzdáleně načítaná data nejsou spustitelný JavaScript ani WebAssembly. Veškerá aplikační logika je součástí instalovaného balíčku rozšíření.

## Sdílení a prodej dat

Rozšíření neprodává údaje o uživatelích a nepředává je třetím stranám pro reklamní, úvěrové ani jiné účely nesouvisející s funkcí rozšíření.

## Citlivé údaje

Rozšíření není určeno ke shromažďování hesel, platebních údajů, zdravotních údajů, osobní komunikace ani jiných citlivých osobních údajů.

## Kontakt

Pro dotazy týkající se ochrany soukromí lze použít GitHub repozitář projektu:
https://github.com/12arnost/trzby-app
