import ONYXKEYS from '@src/ONYXKEYS';
import type {Report} from '@src/types/onyx';

import type {OnyxCollection} from 'react-native-onyx';

/**
 * Returns the report keys an incremental LHN update should recheck: the updated reports, plus the displayed reports
 * linked to them as parent or chat report, in either direction.
 *
 * Whether a report shows in the LHN also depends on its parent and chat report. For example, a transaction thread is
 * hidden once its expense report is down to one expense, and the thread itself doesn't change when that happens.
 */
function getLHNReportKeysToRecheck(updatedReportKeys: string[], displayedReports: Record<string, Report>, reports: OnyxCollection<Report>): string[] {
    const updatedReportIDs = new Set(updatedReportKeys.map((reportKey) => reportKey.replace(ONYXKEYS.COLLECTION.REPORT, '')));
    const reportKeysToRecheck = new Set(updatedReportKeys);

    // A thread's or expense report's LHN check reads its parent and chat report, so recheck it when either one changed
    for (const [reportKey, report] of Object.entries(displayedReports)) {
        if ((!!report.parentReportID && updatedReportIDs.has(report.parentReportID)) || (!!report.chatReportID && updatedReportIDs.has(report.chatReportID))) {
            reportKeysToRecheck.add(reportKey);
        }
    }

    // A displayed parent or chat report can depend on a report that changed, e.g. an expense report listed because its expense thread is
    // unread, or an empty chat kept in the LHN only while one of its threads is open
    for (const reportKey of updatedReportKeys) {
        const report = reports?.[reportKey];
        for (const linkedReportID of [report?.parentReportID, report?.chatReportID]) {
            const linkedReportKey = `${ONYXKEYS.COLLECTION.REPORT}${linkedReportID}`;
            if (linkedReportID && linkedReportKey in displayedReports) {
                reportKeysToRecheck.add(linkedReportKey);
            }
        }
    }

    return Array.from(reportKeysToRecheck);
}

export default getLHNReportKeysToRecheck;
