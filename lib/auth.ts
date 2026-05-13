export const STUB_USER_ID = "97feb076-9e1f-4a89-91b3-2d24b6231842";
export const STUB_PATIENT_ID = "75794434-0bb6-4dd0-b1c7-c26b39a13f03";

export type CurrentUser = {
  userId: string;
  name: string;
  email: string;
};

export type CurrentPatient = {
  patientId: string;
  name: string;
};

export async function getCurrentUser(): Promise<CurrentUser> {
  return {
    userId: STUB_USER_ID,
    name: "Avi Sharma",
    email: "avi@arogya.local",
  };
}

export async function getCurrentPatient(): Promise<CurrentPatient> {
  return {
    patientId: STUB_PATIENT_ID,
    name: "Ramesh Sharma",
  };
}