export const CRN_PREFIX = "crn";
export const CRN_VERSION = "v1";

export const STRUCTURAL_TOKEN_MAX_LENGTH = 64;
export const RESOURCE_ID_MAX_LENGTH = 8192;
export const CRN_MAX_LENGTH = 9216;

export const STRUCTURAL_TOKEN_RE = /^[a-z0-9._-]{1,64}$/;
export const CONTROL_CHAR_RE = /[\x00-\x1F\x7F]/;
