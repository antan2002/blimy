import type {
  DatabaseProviderContribution,
  DatabaseProviderId,
  ExtensionManifest,
} from "../types/extension-manifest";

const PROVIDER_DEFINITIONS: Array<{
  extensionId: string;
  packageName: string;
  name: string;
  description: string;
  provider: DatabaseProviderContribution;
}> = [
  {
    extensionId: "Blimy.database.sqlite",
    packageName: "sqlite",
    name: "SQLite",
    description: "SQLite database browser and query provider.",
    provider: {
      id: "sqlite",
      label: "SQLite",
      isFileBased: true,
      protocolVersion: 1,
      fileExtensions: [".sqlite", ".db", ".sqlite3"],
      sidecar: {
        "darwin-arm64": "bin/blimy-db-sqlite",
        "darwin-x64": "bin/blimy-db-sqlite",
        "linux-arm64": "bin/blimy-db-sqlite",
        "linux-x64": "bin/blimy-db-sqlite",
        "win32-x64": "bin/blimy-db-sqlite.exe",
      },
    },
  },
  {
    extensionId: "Blimy.database.duckdb",
    packageName: "duckdb",
    name: "DuckDB",
    description: "DuckDB database browser and query provider.",
    provider: {
      id: "duckdb",
      label: "DuckDB",
      isFileBased: true,
      protocolVersion: 1,
      fileExtensions: [".duckdb", ".duck"],
      sidecar: {
        "darwin-arm64": "bin/blimy-db-duckdb",
        "darwin-x64": "bin/blimy-db-duckdb",
        "linux-arm64": "bin/blimy-db-duckdb",
        "linux-x64": "bin/blimy-db-duckdb",
        "win32-x64": "bin/blimy-db-duckdb.exe",
      },
    },
  },
  {
    extensionId: "Blimy.database.postgres",
    packageName: "postgres",
    name: "PostgreSQL",
    description: "PostgreSQL connection, schema, and query provider.",
    provider: {
      id: "postgres",
      label: "PostgreSQL",
      isFileBased: false,
      protocolVersion: 1,
      defaultPort: 5432,
      sidecar: {
        "darwin-arm64": "bin/blimy-db-postgres",
        "darwin-x64": "bin/blimy-db-postgres",
        "linux-arm64": "bin/blimy-db-postgres",
        "linux-x64": "bin/blimy-db-postgres",
        "win32-x64": "bin/blimy-db-postgres.exe",
      },
    },
  },
  {
    extensionId: "Blimy.database.mysql",
    packageName: "mysql",
    name: "MySQL",
    description: "MySQL connection, schema, and query provider.",
    provider: {
      id: "mysql",
      label: "MySQL",
      isFileBased: false,
      protocolVersion: 1,
      defaultPort: 3306,
      sidecar: {
        "darwin-arm64": "bin/blimy-db-mysql",
        "darwin-x64": "bin/blimy-db-mysql",
        "linux-arm64": "bin/blimy-db-mysql",
        "linux-x64": "bin/blimy-db-mysql",
        "win32-x64": "bin/blimy-db-mysql.exe",
      },
    },
  },
  {
    extensionId: "Blimy.database.mongodb",
    packageName: "mongodb",
    name: "MongoDB",
    description: "MongoDB connection, collection, and document provider.",
    provider: {
      id: "mongodb",
      label: "MongoDB",
      isFileBased: false,
      protocolVersion: 1,
      defaultPort: 27017,
      sidecar: {
        "darwin-arm64": "bin/blimy-db-mongodb",
        "darwin-x64": "bin/blimy-db-mongodb",
        "linux-arm64": "bin/blimy-db-mongodb",
        "linux-x64": "bin/blimy-db-mongodb",
        "win32-x64": "bin/blimy-db-mongodb.exe",
      },
    },
  },
  {
    extensionId: "Blimy.database.redis",
    packageName: "redis",
    name: "Redis",
    description: "Redis connection, key scanning, and value editing provider.",
    provider: {
      id: "redis",
      label: "Redis",
      isFileBased: false,
      protocolVersion: 1,
      defaultPort: 6379,
      sidecar: {
        "darwin-arm64": "bin/blimy-db-redis",
        "darwin-x64": "bin/blimy-db-redis",
        "linux-arm64": "bin/blimy-db-redis",
        "linux-x64": "bin/blimy-db-redis",
        "win32-x64": "bin/blimy-db-redis.exe",
      },
    },
  },
];

export function getDatabaseProviderExtensions(): ExtensionManifest[] {
  return PROVIDER_DEFINITIONS.filter(({ provider }) => provider.id === "sqlite").map(
    ({ extensionId, name, description, provider }) => ({
      id: extensionId,
      name,
      displayName: name,
      description,
      version: "1.0.0",
      publisher: "Blimy",
      categories: ["Database"],
      databases: [provider],
      activationEvents: [`onDatabase:${provider.id}`],
      license: "MIT",
      repository: {
        type: "git",
        url: "https://github.com/antan2002/blimy/tree/master/extensions",
      },
      icon: "icon.svg",
    }),
  );
}

export function getDatabaseProviderContribution(
  providerId: DatabaseProviderId,
): DatabaseProviderContribution | undefined {
  return PROVIDER_DEFINITIONS.find((item) => item.provider.id === providerId)?.provider;
}
