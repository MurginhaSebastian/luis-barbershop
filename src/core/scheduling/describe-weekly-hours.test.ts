import { expect, test } from "vitest";
import { describeWeeklyHours } from "./describe-weekly-hours";

const day = [
  { openMinute: 540, closeMinute: 780 },
  { openMinute: 840, closeMinute: 1200 },
];

test("agrupa días seguidos iguales, con almuerzo y domingo cerrado", () => {
  expect(describeWeeklyHours([[], day, day, day, day, day, day])).toBe("lun–sáb 9:00–13:00 y 14:00–20:00; dom cerrado");
});

test("separa los días distintos y usa minutos con dos cifras", () => {
  const short = [{ openMinute: 600, closeMinute: 905 }];
  expect(describeWeeklyHours([short, day, day, short, short, short, short])).toBe("lun–mar 9:00–13:00 y 14:00–20:00; mié–dom 10:00–15:05");
});

test("sin ningún tramo configurado, texto vacío", () => {
  expect(describeWeeklyHours([[], []])).toBe("");
});
