export function round(value: number, decimalPlaces: number = 6): number {
  return Number(
    Math.round(parseFloat(value + 'e' + decimalPlaces)) + 'e-' + decimalPlaces,
  );
}

export function stringifyJson(object: any) {
  const stringify = Object.entries(object).reduce(
    (acc: string, [k, v], idx) => {
      if (idx === 0) {
        return `""${k}"":${v}`;
      }
      return acc + ',' + `""${k}"":${v}`;
    },
    '',
  );
  return `"{${stringify}"}`;
}
