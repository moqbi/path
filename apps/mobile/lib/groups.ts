/** أشكال المحادثات الجماعيّة كما يردّها `/v1/groups` (القاعدة ٢١٥). */

export type GroupPerson = {
  id: string;
  name: string;
  memberNo: number;
  isPlus?: boolean;
  tag?: { name: string; bg: string; fg: string } | null;
  avatarMediaId: string | null;
  frame: { spec: string; mediaId: string | null; frameHole?: number | null } | null;
  charm: { spec: string; mediaId: string | null } | null;
};

export type GroupLine = {
  id: string;
  body: string;
  kind: "TEXT" | "PHOTO" | "VOICE";
  mediaId: string | null;
  senderId: string;
  createdAt: string;
  sender: GroupPerson;
};

export type GroupRow = {
  id: string;
  name: string;
  updatedAt: string;
  members: number;
  last: GroupLine | null;
  unseen: number;
};

export type GroupThread = {
  id: string;
  name: string;
  members: GroupPerson[];
  canManage: boolean;
  messages: GroupLine[];
};
