/** Russian cardinal forms, including 11–14 and numbers ending in 1. */
function profileForm(count: number): number {
  const lastTwo = count % 100;
  if (lastTwo >= 11 && lastTwo <= 14) return 2;
  const last = count % 10;
  return last === 1 ? 0 : last >= 2 && last <= 4 ? 1 : 2;
}

export function profileCount(count: number): string {
  return `${count} ${['профиль', 'профиля', 'профилей'][profileForm(count)]}`;
}

export function matchingVerb(count: number, capitalize = false): string {
  const verb = profileForm(count) === 0 ? 'подходит' : 'подходят';
  return capitalize ? verb[0].toUpperCase() + verb.slice(1) : verb;
}
