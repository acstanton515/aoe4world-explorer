import { Link, NavLink, useIsRouting, useLocation } from "@solidjs/router";
import { Component, createMemo, createResource, createSignal, Show, Suspense, onCleanup, For } from "solid-js";
import { StatBar } from "../components/Stats";
import { globalAgeFilter, hideNav, setHideNav } from "../global";
import { UnitCard } from "../components/UnitCard";
import { CIVILIZATIONS, ITEMS } from "../config";
import { findClosestMatch, getUnitsByClass } from "../query/utils";
import { calculateStatParts, getUnitStats } from "../query/stats";
import { modifierMatches } from "../query/utils";
import { civAbbr, Item, Modifier, Unit } from "../types/data";
import { CalculatedStats, Stat, StatProperty } from "../types/stats";
import { CivFlag } from "../components/CivFlag";
import { Icon } from "../components/Icon";

async function getComparer(unit: { name: string, civAbbr: civAbbr }) {
  const civ = CIVILIZATIONS[unit.civAbbr];
  const item = await findClosestMatch(ITEMS.UNITS, unit.name, civ);
  const stats = await getUnitStats(ITEMS.UNITS, unit.name, civ);
  return { item, stats, civ };
};

async function getUnits(units: { classes: string, civAbbr: civAbbr }) {
  const civ = (await import("@data/sdk")).civilizations.Get(units.civAbbr);
  const classList = units.classes.replaceAll('_','').trim().replaceAll('  ',' ').split(' ');
  return getUnitsByClass(civ.units, classList);
};

const CompareCard: Component<{ ally: any, enemy: any }> = (props) => {
  return (
    <div class="flex-auto flex flex-col gap-8">
      <div class=" bg-black/70 rounded-2xl p-6 ">
        <p>{props.ally().item.name} vs {props.enemy().item.name}</p>
      </div>
    </div>
  );
};


const CompareToolbar: Component<{ player: string, ageFilter: any, setAgeFilter: any, setCivFilter: any, unitClassFilter: any, setUnitClassFilter: any}> = (props) => { //civFilter, setCivFilter 
  const pending = useIsRouting();
  const navButtonClass =
    "w-12 h-10 md:w-10 lg:h-8 md:hover:bg-white md:hover:text-black bg-gray-900 text-white/70text-lg px-3 grid rounded-md flex-none transition";

  return (
    <div class="bg-gray-700 z-10 border-bottom border border-gray-500 sticky mt-25 top-0" classList={{ "opacity-20": pending() }}>
      <div class="max-w-screen-2xl py-2 px-4 lg:px-8 h-auto text-base lg:p-3 mx-auto flex flex-row items-center flex-wrap sm:flex-nowrap gap-2 lg:gap-5">
        <div class="hidden lg:flex flex-row gap-2 h-10 lg:h-8 items-center">
          <h2>{props.player}</h2>
          <For each={Object.values(CIVILIZATIONS)}>
            {(civ) => (
              <div class="group inline-block">
              <button 
                class="relative w-12 h-7 rounded-md overflow-hidden border-2 shadow-inner opacity-50 hover:opacity-100  border-transparent hidden xl:block transition"
                onClick={() => props.setCivFilter(civ.abbr)}
              >
                <CivFlag abbr={civ.abbr} class="h-full w-full object-cover" />
              </button>
              </div>
            )}
          </For>
        </div>
        <div class="flex items-center text-center bg-gray-900 h-10 lg:h-8 rounded-md">
          <button
            class="w-8 h-full z-2 -mr-4 disabled:opacity-50"
            onClick={() => props.setAgeFilter(Math.max(1, props.ageFilter() - 1))}
            disabled={props.ageFilter() == 1}
          >
            <Icon icon="angle-left" />
          </button>
          <span class="w-12 md:w-24 pointer-events-none">
            <span class="hidden md:inline">Age </span>
            {["I", "II", "III", "IV"][props.ageFilter() - 1]}
          </span>
          <button
            class="w-8 h-full z-2 -ml-4 disabled:opacity-50"
            onClick={() => props.setAgeFilter(Math.min(4, props.ageFilter() + 1))}
            disabled={props.ageFilter() == 4}
          >
            <Icon icon="angle-right" />
          </button>
        </div>
        <div class="mr-2 float-right">
          <div class="relative">
            <select
              name="unitClassFilter1"
              class="text-white appearance-none block w-full bg-black pl-6 pr-7 py-3 placeholder-gray-900 rounded-md focus:outline-none"
              onChange={(e) => {props.setUnitClassFilter(e.currentTarget.value + ' ' + props.unitClassFilter().split(' ')[1] + ' ' + props.unitClassFilter().split(' ')[2])}}
            >
              <option selected value="_">All</option>
              <option value="heavy">Heavy</option>
              <option value="light">Light</option>
            </select>
            <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-white-700">
              <svg class="fill-current h-4 w-4" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z">
                </path>
              </svg>
            </div>
          </div>
        </div>
        <div class="mr-2 float-right">
          <div class="relative">
            <select
              name="unitClassFilter2"
              class="text-white appearance-none block w-full bg-black pl-6 pr-7 py-3 placeholder-gray-900 rounded-md focus:outline-none"
              onChange={(e) => {props.setUnitClassFilter(props.unitClassFilter().split(' ')[0] + ' ' + e.currentTarget.value + ' ' + props.unitClassFilter().split(' ')[2])}}
            >
              <option selected value="_">All</option>
              <option value="melee">Melee</option>
              <option value="ranged">Ranged</option>
            </select>
            <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-white-700">
              <svg class="fill-current h-4 w-4" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z">
                </path>
              </svg>
            </div>
          </div>
        </div>
        <div class="mr-2 float-right">
          <div class="relative">
            <select
              name="unitClassFilter3"
              class="text-white appearance-none block w-full bg-black pl-6 pr-7 py-3 placeholder-gray-900 rounded-md focus:outline-none"
              onChange={(e) => {props.setUnitClassFilter(props.unitClassFilter().split(' ')[0] + ' ' + props.unitClassFilter().split(' ')[1] + ' ' + e.currentTarget.value)}}
            >
              <option value="infantry|cavalry">Units</option>
              <option value="_">All</option>
              <option selected value="infantry">Infantry</option>
              <option value="cavalry">Cavalry</option>
              <option value="siege">Siege Units</option>
              <option value="ships">Ship Units</option>
            </select>
            <div class="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-white-700">
              <svg class="fill-current h-4 w-4" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path d="M9.293 12.95l.707.707L15.657 8l-1.414-1.414L10 10.828 5.757 6.586 4.343 8z">
                </path>
              </svg>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

/*

*/

export const CompareRoute = () => {
  setHideNav(true);
  onCleanup(() => setHideNav(false));
  
  const [allyAgeFilter, setAllyAgeFilter] = createSignal(2);
  const [allyUnitClassFilter, setAllyUnitClassFilter] = createSignal<string>('_ _ infantry');
  
  const [allyUnitFilter, setAllyUnitFilter] = createSignal<string>('spearman');
  const [allyCivFilter, setAllyCivFilter] = createSignal<civAbbr>('ab');
  
  const derivedAllyUnits = createMemo(() => ({ classes: allyUnitClassFilter(), civAbbr: allyCivFilter() }));
  const [allyUnits] = createResource(derivedAllyUnits, getUnits);
  
  const derivedAllyUnit = createMemo(() => ({ name: allyUnitFilter(), civAbbr: allyCivFilter() }));
  const [ally] = createResource(derivedAllyUnit, getComparer);


  const [enemyAgeFilter, setEnemyAgeFilter] = createSignal(2);
  const [enemyUnitClassFilter, setEnemyUnitClassFilter] = createSignal<string>('_ _ infantry');
  
  const [enemyUnitFilter, setEnemyUnitFilter] = createSignal<string>('archer');
  const [enemyCivFilter, setEnemyCivFilter] = createSignal<civAbbr>('de');
  const derivedEnemyUnit = createMemo(() => ({ name: enemyUnitFilter(), civAbbr: enemyCivFilter() }));
  const [enemy] = createResource(derivedEnemyUnit, getComparer);


  //            <p>{allyUnitClassFilter} and {enemyUnitClassFilter}</p>
  return (
    <>
      <CompareToolbar player="P1" ageFilter={allyAgeFilter} setAgeFilter={setAllyAgeFilter} setCivFilter={setAllyCivFilter} unitClassFilter={allyUnitClassFilter} setUnitClassFilter={setAllyUnitClassFilter}></CompareToolbar>
      <CompareToolbar player="P2" ageFilter={enemyAgeFilter} setAgeFilter={setEnemyAgeFilter} setCivFilter={setEnemyCivFilter} unitClassFilter={enemyUnitClassFilter} setUnitClassFilter={setEnemyUnitClassFilter}></CompareToolbar>
    
      <div class="max-w-screen-lg p-4 mx-auto">
        <div class="flex gap-4">
          <Show when={!ally.loading && !enemy.loading}>
            <div class="flex-auto flex flex-col gap-4">
              <UnitCard unit={ally().item} civ={ally().civ}></UnitCard>
            </div>
            <CompareCard ally={ally} enemy={enemy}></CompareCard>
            <div>
              <pre>{JSON.stringify(allyUnits(), null, 2)}</pre>
            </div>
            <div class="flex-auto">
              <UnitCard unit={enemy().item} civ={enemy().civ}></UnitCard>
            </div>
          </Show>
        </div>
      </div>
    </>
  );
};