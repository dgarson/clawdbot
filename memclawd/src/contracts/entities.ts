export type EntityBase = {
  id: string;
  type: string;
  label: string;
  description?: string;
  aliases?: string[];
  tags?: string[];
  properties?: Record<string, unknown>;
  confidence?: number;
  createdAt?: string;
  updatedAt?: string;
};

export type PersonEntity = EntityBase & {
  type: "person";
  role?: string;
  organization?: string;
};

export type ProjectEntity = EntityBase & {
  type: "project";
  status?: string;
  startDate?: string;
  endDate?: string;
};

export type TechnologyEntity = EntityBase & {
  type: "technology";
  category?: string;
  version?: string;
};

export type OrganizationEntity = EntityBase & {
  type: "organization";
  industry?: string;
  location?: string;
};

export type LocationEntity = EntityBase & {
  type: "location";
  region?: string;
};

export type DocumentEntity = EntityBase & {
  type: "document";
  uri?: string;
};

export type TaskEntity = EntityBase & {
  type: "task";
  status?: string;
  dueDate?: string;
};

export type MemoryEntity =
  | PersonEntity
  | ProjectEntity
  | TechnologyEntity
  | OrganizationEntity
  | LocationEntity
  | DocumentEntity
  | TaskEntity
  | EntityBase;

export type EntityRelationType =
  | "mentions"
  | "owns"
  | "uses"
  | "related_to"
  | "member_of"
  | "depends_on"
  | "authored_by"
  | "located_in";

export type EntityRelation = {
  id: string;
  sourceId: string;
  targetId: string;
  type: EntityRelationType;
  properties?: Record<string, unknown>;
  confidence?: number;
};
