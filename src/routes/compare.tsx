import { Link, NavLink, useIsRouting, useLocation } from "@solidjs/router";
import { Component, createMemo, createResource, createSignal, Show, Suspense, onCleanup, For } from "solid-js";
import { StatBar } from "../components/Stats";
import { globalAgeFilter, hideNav, setHideNav } from "../global";
import { UnitCard } from "../components/UnitCard";
import { CIVILIZATIONS, ITEMS } from "../config";
import { findClosestMatch } from "../query/utils";
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


const CompareToolbar: Component<{ player: string, ageFilter: any, setAgeFilter: any, setCivFilter: any}> = (props) => { //civFilter, setCivFilter 
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
      </div>
    </div>
  );
};


export const CompareRoute = () => {
  setHideNav(true);
  onCleanup(() => setHideNav(false));
  
  const [show, setShow] = createSignal(false);
  
  const [allyAgeFilter, setAllyAgeFilter] = createSignal(4);
  
  const [allyUnitFilter, setAllyUnitFilter] = createSignal<string>('spearman');
  const [allyCivFilter, setAllyCivFilter] = createSignal<civAbbr>('ab');
  //const [ally] = createResource(() => getComparer("spearman", allyCivFilter);
  const derivedAllyUnit = createMemo(() => ({ name: allyUnitFilter(), civAbbr: allyCivFilter() }));
  const [ally] = createResource(derivedAllyUnit, getComparer);


  const [enemyAgeFilter, setEnemyAgeFilter] = createSignal(4);
  
  const [enemyUnitFilter, setEnemyUnitFilter] = createSignal<string>('archer');
  const [enemyCivFilter, setEnemyCivFilter] = createSignal<civAbbr>('de');
  //const [enemy] = createResource(() => getComparer("horseman", enemyCivFilter);
  const derivedEnemyUnit = createMemo(() => ({ name: enemyUnitFilter(), civAbbr: enemyCivFilter() }));
  const [enemy] = createResource(derivedEnemyUnit, getComparer);

  const compareProps: Partial<StatProperty[]> = [
    "hitpoints",
    "attackSpeed",
    "moveSpeed",
    "meleeAttack",
    "meleeArmor",
    "rangedAttack",
    "rangedArmor",
    "fireAttack",
    "fireArmor",
  ];
  const netstats = createMemo(() =>
    compareProps.reduce((acc, prop) => {
      const att = calculateStatParts(ally()?.stats[prop], allyAgeFilter(), { target: enemy()?.item, decimals: 2 });
      const def = calculateStatParts(enemy()?.stats[prop], enemyAgeFilter(), { target: ally()?.item, decimals: 2 });

      acc[prop] = { diff: att.total + att.bonus - def.total + def.bonus, ally: att, enemy: def };
      return acc;
    }, {} as Record<StatProperty, { diff: number; ally: CalculatedStats; enemy: CalculatedStats }>)
  );

  const attackTypes = ["melee", "ranged", "fire", "siege"] as const;

  const results = createMemo(() => {
    const attacks = attackTypes.reduce(
      (acc, type) => {
        const damage = netstats()?.[`${type}Attack`];
        const armor = netstats()?.[`${type}Armor`];
        acc.ally[type] = damage?.ally.max ? Math.round(Math.max(1, damage.ally.max - armor.enemy.max)) : 0;
        acc.enemy[type] = damage?.enemy.max ? Math.round(Math.max(1, damage.enemy.max - armor.ally.max)) : 0;
        return acc;
      },
      { ally: {}, enemy: {} } as Record<"ally" | "enemy", Record<typeof attackTypes[number], number>>
    );

    const [allyAttack, allyDamage] = Object.entries(attacks.ally).find(([key, value]) => value > 0) || ["", 0];
    const [enemyAttack, enemyDamage] = Object.entries(attacks.enemy).find(([key, value]) => value > 0) || ["", 0];

    const allyAttacksNeed = Math.ceil(netstats().hitpoints.enemy.max / allyDamage),
      enemyAttacksNeed = Math.ceil(netstats().hitpoints.ally.max / enemyDamage),
      allyAttackSpeed = netstats().attackSpeed.ally.max,
      enemyAttackSpeed = netstats().attackSpeed.enemy.max,
      allyTimeNeed = allyAttacksNeed * allyAttackSpeed,
      enemyTimeNeed = enemyAttacksNeed * enemyAttackSpeed,
      allyHealthLeft = Math.max(0, netstats().hitpoints.ally.max - Math.floor(allyTimeNeed / enemyAttackSpeed) * enemyDamage),
      enemyHealthLeft = Math.max(0, netstats().hitpoints.enemy.max - Math.floor(enemyTimeNeed / allyAttackSpeed) * allyDamage);

    const winner = allyTimeNeed < enemyTimeNeed ? "ally" : "enemy";
    return {
      ally: {
        attack: allyAttack,
        damage: allyDamage,
        attackSpeed: allyAttackSpeed,
        attacksNeeded: allyAttacksNeed,
        timeNeeded: allyTimeNeed,
        hpLeft: allyHealthLeft,
      },
      enemy: {
        attack: enemyAttack,
        damage: enemyDamage,
        attackSpeed: enemyAttackSpeed,
        attacksNeeded: enemyAttacksNeed,
        timeNeeded: enemyTimeNeed,
        hpLeft: enemyHealthLeft,
      },
      winner: winner,
    };
  });
  
  return (
    <>
      <CompareToolbar player="You  " ageFilter={allyAgeFilter} setAgeFilter={setAllyAgeFilter} setCivFilter={setAllyCivFilter}></CompareToolbar>
      <CompareToolbar player="Enemy" ageFilter={enemyAgeFilter} setAgeFilter={setEnemyAgeFilter} setCivFilter={setEnemyCivFilter}></CompareToolbar>
    
      <div class="max-w-screen-lg p-4 mx-auto">
        <div class="flex gap-4">
          <Show when={!ally.loading && !enemy.loading && results()}>
            <div class="flex-auto flex flex-col gap-4">
              <p>
                The resulting {results().ally.attack} attack is {results().ally.damage} damage every {results().ally.attackSpeed}s so {ally().item.name} needs{" "}
                {results().ally.attacksNeeded} attacks and {results().ally.timeNeeded} seconds to kill {enemy().item.name} and has {results().ally.hpLeft} HP
                left.
              </p>
              <div>
                <pre>{JSON.stringify(results().ally, null, 2)}</pre>
                <pre>{JSON.stringify(results().ally, null, 2)}</pre>
              </div>
              {netstats().moveSpeed.ally.max > netstats().moveSpeed.enemy.max && <p>+ Can outrun/kite {enemy().item.name}</p>}
              <UnitCard unit={ally().item} civ={ally().civ}></UnitCard>
            </div>
            <div class="flex-auto">
              {results().winner === "ally" ? ally().item.name + " wins!" : enemy().item.name + " wins!"}
              <br />
            </div>
            <div class="flex-auto">
              <p>
                The resulting {results().enemy.attack} attack is {results().enemy.damage} damage every {results().enemy.attackSpeed}s so {enemy().item.name}{" "}
                needs {results().enemy.attacksNeeded} attacks and {results().enemy.timeNeeded} seconds to kill {ally().item.name} and has{" "}
                {results().enemy.hpLeft} HP left.
              </p>
              <p>{}</p>
              <div>
                <pre>{JSON.stringify(results().ally, null, 2)}</pre>
                <pre>{JSON.stringify(results().enemy, null, 2)}</pre>
              </div>
              {netstats().moveSpeed.enemy.max > netstats().moveSpeed.ally.max && <p>+ Can outrun/kite {ally().item.name}</p>}
              <UnitCard unit={enemy().item} civ={enemy().civ}></UnitCard>
            </div>
          </Show>
        </div>
      </div>
    </>
  );
};