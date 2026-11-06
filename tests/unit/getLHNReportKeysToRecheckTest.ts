import getLHNReportKeysToRecheck from '@libs/getLHNReportKeysToRecheck';

import CONST from '@src/CONST';
import ONYXKEYS from '@src/ONYXKEYS';
import type {Report} from '@src/types/onyx';

const reportKey = (reportID: string) => `${ONYXKEYS.COLLECTION.REPORT}${reportID}`;

const expenseReport = {reportID: '1', type: CONST.REPORT.TYPE.EXPENSE, chatReportID: '3'} as Report;
const expenseThread = {reportID: '2', type: CONST.REPORT.TYPE.CHAT, parentReportID: '1', parentReportActionID: '100'} as Report;
const otherChat = {reportID: '4', type: CONST.REPORT.TYPE.CHAT} as Report;

const displayedReports: Record<string, Report> = {
    [reportKey('1')]: expenseReport,
    [reportKey('2')]: expenseThread,
    [reportKey('4')]: otherChat,
};

const reports: Record<string, Report> = {
    ...displayedReports,
    [reportKey('5')]: {reportID: '5', type: CONST.REPORT.TYPE.CHAT, parentReportID: '1', parentReportActionID: '101'},
};

describe('getLHNReportKeysToRecheck', () => {
    it('should recheck a displayed thread when its parent report changed', () => {
        // Given an expense report that changed, and a displayed thread of one of its expenses
        // When an incremental LHN update picks which reports to recheck
        const result = getLHNReportKeysToRecheck([reportKey('1')], displayedReports, reports);

        // Then the thread is rechecked too, because a thread's LHN visibility depends on its parent report
        expect(result).toEqual([reportKey('1'), reportKey('2')]);
    });

    it('should recheck a displayed report when its chat report changed', () => {
        // Given a chat report that changed, and a displayed expense report that belongs to it
        // When an incremental LHN update picks which reports to recheck
        const result = getLHNReportKeysToRecheck([reportKey('3')], displayedReports, reports);

        // Then the expense report is rechecked too, because its LHN check reads its chat report
        expect(result).toEqual([reportKey('3'), reportKey('1')]);
    });

    it('should recheck a displayed parent report when one of its threads changed', () => {
        // Given a thread that is not in the LHN changed, e.g. it was read, and its expense report is displayed
        // When an incremental LHN update picks which reports to recheck
        const result = getLHNReportKeysToRecheck([reportKey('5')], displayedReports, reports);

        // Then the expense report is rechecked too, because its LHN check can read its expense thread
        expect(result).toEqual([reportKey('5'), reportKey('1')]);
    });

    it('should not recheck displayed reports that are not linked to the updated reports', () => {
        // Given an unrelated chat that changed, which must not widen the update
        // When an incremental LHN update picks which reports to recheck
        const result = getLHNReportKeysToRecheck([reportKey('4')], displayedReports, reports);

        // Then only that chat is rechecked, so an update stays as small as before
        expect(result).toEqual([reportKey('4')]);
    });

    it('should return no keys when no report changed', () => {
        // Given no updated reports, as when a dependency changed but no report did
        // When an incremental LHN update picks which reports to recheck
        const result = getLHNReportKeysToRecheck([], displayedReports, reports);

        // Then nothing is added, so the caller can still tell that no report key changed
        expect(result).toEqual([]);
    });
});
