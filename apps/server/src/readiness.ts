export interface CampSettingsCountDatabase {
  campSettings: {
    count(): Promise<number>;
  };
}

export type ReadinessCheck = () => Promise<void>;

export function createCampSettingsReadinessCheck(
  database: CampSettingsCountDatabase,
): ReadinessCheck {
  return async () => {
    const campSettingsCount = await database.campSettings.count();
    if (campSettingsCount !== 1) {
      throw new Error(
        `Camp settings readiness requires exactly one row; found ${campSettingsCount}.`,
      );
    }
  };
}
