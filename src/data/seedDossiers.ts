import { IdeaDossier } from "../types/index.js";
import seeds from "./seedDossiers.json" with { type: "json" };

export const seedDossiers: IdeaDossier[] = seeds as unknown as IdeaDossier[];
