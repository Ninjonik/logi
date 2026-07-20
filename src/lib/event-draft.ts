type DraftEventSchedule = {
  registrationEnd: string;
  meetingStart: string;
  gameStart: string;
  gameEnd: string;
  statusUpdatedAt: string;
  createdAt: string;
  updatedAt: string;
};

function addMinutes(date: Date, minutes: number) {
  return new Date(date.getTime() + minutes * 60 * 1000);
}

export function createDraftEventSchedule(now = new Date()): DraftEventSchedule {
  const base = new Date(now);
  base.setSeconds(0, 0);
  base.setMinutes(0);
  base.setHours(base.getHours() + 1);

  const registrationEnd = addMinutes(base, 30);
  const meetingStart = addMinutes(base, 60);
  const gameStart = addMinutes(base, 90);
  const gameEnd = addMinutes(base, 210);
  const createdAt = now.toISOString();

  return {
    registrationEnd: registrationEnd.toISOString(),
    meetingStart: meetingStart.toISOString(),
    gameStart: gameStart.toISOString(),
    gameEnd: gameEnd.toISOString(),
    statusUpdatedAt: createdAt,
    createdAt,
    updatedAt: createdAt,
  };
}
