/**
 * Microsoft Bing Ads Tier 1 data sync
 *
 * 8 Tier 1 reports (SOAP-based Reporting API):
 *   CampaignPerformanceReportRequest, AdGroupPerformanceReportRequest,
 *   AdPerformanceReportRequest, KeywordPerformanceReportRequest,
 *   SearchQueryPerformanceReportRequest, GeographicPerformanceReportRequest,
 *   AgeGenderAudienceReportRequest, ConversionPerformanceReportRequest
 */

import type { SyncResult } from './types';

const DATE_RANGE_DAYS = 30;

type BingReport = {
  reportType: string;
  reportName: string;
  columns: string[];
};

const TIER1_REPORTS: BingReport[] = [
  {
    reportType: 'CampaignPerformanceReport',
    reportName: 'CampaignPerformanceReportRequest',
    columns: [
      'TimePeriod', 'AccountId', 'AccountName', 'CampaignId', 'CampaignName',
      'CampaignStatus', 'CampaignType', 'BudgetAssociationStatus',
      'Impressions', 'Clicks', 'Ctr', 'AverageCpc', 'Spend',
      'Conversions', 'Revenue', 'ConversionRate', 'CostPerConversion',
      'ImpressionSharePercent', 'QualityScore', 'DeviceType', 'Network'
    ]
  },
  {
    reportType: 'AdGroupPerformanceReport',
    reportName: 'AdGroupPerformanceReportRequest',
    columns: [
      'TimePeriod', 'AccountId', 'CampaignId', 'CampaignName',
      'AdGroupId', 'AdGroupName', 'AdGroupStatus',
      'Impressions', 'Clicks', 'Ctr', 'AverageCpc', 'Spend',
      'Conversions', 'Revenue', 'ConversionRate', 'QualityScore',
      'DeviceType', 'Network'
    ]
  },
  {
    reportType: 'AdPerformanceReport',
    reportName: 'AdPerformanceReportRequest',
    columns: [
      'TimePeriod', 'AccountId', 'CampaignId', 'AdGroupId',
      'AdId', 'AdTitle', 'AdDescription', 'AdStatus', 'AdType',
      'Impressions', 'Clicks', 'Ctr', 'AverageCpc', 'Spend',
      'Conversions', 'Revenue', 'DeviceType'
    ]
  },
  {
    reportType: 'KeywordPerformanceReport',
    reportName: 'KeywordPerformanceReportRequest',
    columns: [
      'TimePeriod', 'AccountId', 'CampaignId', 'AdGroupId',
      'KeywordId', 'Keyword', 'KeywordStatus', 'MatchType',
      'BidMatchType', 'QualityScore', 'AdRelevance', 'LandingPageRelevance',
      'LandingPageUserExperience', 'ExpectedCtr',
      'Impressions', 'Clicks', 'Ctr', 'AverageCpc', 'Spend',
      'Conversions', 'Revenue', 'ImpressionSharePercent', 'DeviceType'
    ]
  },
  {
    reportType: 'SearchQueryPerformanceReport',
    reportName: 'SearchQueryPerformanceReportRequest',
    columns: [
      'TimePeriod', 'AccountId', 'CampaignId', 'AdGroupId',
      'SearchQuery', 'Keyword', 'MatchType', 'BidMatchType',
      'Impressions', 'Clicks', 'Ctr', 'AverageCpc', 'Spend',
      'Conversions', 'Revenue', 'DeviceType'
    ]
  },
  {
    reportType: 'GeographicPerformanceReport',
    reportName: 'GeographicPerformanceReportRequest',
    columns: [
      'TimePeriod', 'AccountId', 'CampaignId', 'AdGroupId',
      'Country', 'State', 'MetroArea', 'City',
      'Impressions', 'Clicks', 'Ctr', 'AverageCpc', 'Spend',
      'Conversions', 'Revenue', 'DeviceType'
    ]
  },
  {
    reportType: 'AgeGenderAudienceReport',
    reportName: 'AgeGenderAudienceReportRequest',
    columns: [
      'TimePeriod', 'AccountId', 'CampaignId', 'AdGroupId',
      'AgeGroup', 'Gender',
      'Impressions', 'Clicks', 'Ctr', 'AverageCpc', 'Spend',
      'Conversions', 'Revenue'
    ]
  },
  {
    reportType: 'ConversionPerformanceReport',
    reportName: 'ConversionPerformanceReportRequest',
    columns: [
      'TimePeriod', 'AccountId', 'CampaignId', 'AdGroupId',
      'Goal', 'GoalType',
      'Conversions', 'Revenue', 'ConversionRate',
      'Assists', 'AllConversions', 'AllRevenue'
    ]
  }
];

function buildSoapRequest(
  accessToken: string,
  developerToken: string,
  report: BingReport,
  customerId: string,
  accountId: string
): string {
  const today = new Date();
  const start = new Date();
  start.setDate(start.getDate() - DATE_RANGE_DAYS);

  const columns = report.columns
    .map((col) => `<Column>${col}</Column>`)
    .join('\n          ');

  return `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Header>
    <h:AuthenticationToken xmlns:h="https://bingads.microsoft.com/Reporting/v13">${accessToken}</h:AuthenticationToken>
    <h:CustomerAccountId xmlns:h="https://bingads.microsoft.com/Reporting/v13">${accountId}</h:CustomerAccountId>
    <h:CustomerId xmlns:h="https://bingads.microsoft.com/Reporting/v13">${customerId}</h:CustomerId>
    <h:DeveloperToken xmlns:h="https://bingads.microsoft.com/Reporting/v13">${developerToken}</h:DeveloperToken>
  </s:Header>
  <s:Body>
    <SubmitGenerateReportRequest xmlns="https://bingads.microsoft.com/Reporting/v13">
      <ReportRequest i:type="${report.reportName}" xmlns:i="http://www.w3.org/2001/XMLSchema-instance">
        <ExcludeColumnHeaders>false</ExcludeColumnHeaders>
        <ExcludeReportFooter>true</ExcludeReportFooter>
        <ExcludeReportHeader>true</ExcludeReportHeader>
        <Format>Csv</Format>
        <ReportName>${report.reportType}</ReportName>
        <ReturnOnlyCompleteData>false</ReturnOnlyCompleteData>
        <Aggregation>Daily</Aggregation>
        <Columns>
          ${columns}
        </Columns>
        <Scope>
          <AccountIds xmlns:a="http://schemas.microsoft.com/2003/10/Serialization/Arrays">
            <a:long>${accountId}</a:long>
          </AccountIds>
        </Scope>
        <Time>
          <CustomDateRangeStart>
            <Day>${start.getDate()}</Day>
            <Month>${start.getMonth() + 1}</Month>
            <Year>${start.getFullYear()}</Year>
          </CustomDateRangeStart>
          <CustomDateRangeEnd>
            <Day>${today.getDate()}</Day>
            <Month>${today.getMonth() + 1}</Month>
            <Year>${today.getFullYear()}</Year>
          </CustomDateRangeEnd>
        </Time>
      </ReportRequest>
    </SubmitGenerateReportRequest>
  </s:Body>
</s:Envelope>`;
}

function getMockRows(reportType: string): unknown[] {
  const today = new Date().toISOString().split('T')[0];
  switch (reportType) {
    case 'CampaignPerformanceReport':
      return [
        { timePeriod: today, campaignId: 'mock-bc-1', campaignName: 'Brand - Exact', campaignStatus: 'Active', impressions: 4200, clicks: 148, ctr: 3.52, averageCpc: 0.82, spend: 121.36, conversions: 9, revenue: 540 },
        { timePeriod: today, campaignId: 'mock-bc-2', campaignName: 'Competitor - Phrase', campaignStatus: 'Active', impressions: 2800, clicks: 84, ctr: 3.00, averageCpc: 1.10, spend: 92.40, conversions: 5, revenue: 300 }
      ];
    case 'AdGroupPerformanceReport':
      return [
        { timePeriod: today, adGroupId: 'mock-bag-1', adGroupName: 'Core Terms', campaignId: 'mock-bc-1', impressions: 2400, clicks: 88, spend: 72.16, conversions: 6 },
        { timePeriod: today, adGroupId: 'mock-bag-2', adGroupName: 'Long Tail', campaignId: 'mock-bc-1', impressions: 1800, clicks: 60, spend: 49.20, conversions: 3 }
      ];
    case 'AdPerformanceReport':
      return [
        { timePeriod: today, adId: 'mock-bad-1', adTitle: 'Official Store - Up to 40% Off', adStatus: 'Active', impressions: 1400, clicks: 56, ctr: 4.00, spend: 45.92, conversions: 4 }
      ];
    case 'KeywordPerformanceReport':
      return [
        { timePeriod: today, keyword: 'running shoes', matchType: 'Exact', qualityScore: 8, impressions: 820, clicks: 38, ctr: 4.63, averageCpc: 0.78, spend: 29.64, conversions: 3 },
        { timePeriod: today, keyword: 'buy shoes online', matchType: 'Phrase', qualityScore: 6, impressions: 640, clicks: 22, ctr: 3.44, averageCpc: 1.02, spend: 22.44, conversions: 2 }
      ];
    case 'SearchQueryPerformanceReport':
      return [
        { timePeriod: today, searchQuery: 'best running shoes india', keyword: 'running shoes', matchType: 'Phrase', impressions: 280, clicks: 18, spend: 14.76, conversions: 2 },
        { timePeriod: today, searchQuery: 'free shipping shoes', keyword: 'buy shoes online', matchType: 'Broad', impressions: 120, clicks: 3, spend: 3.06, conversions: 0 }
      ];
    case 'GeographicPerformanceReport':
      return [
        { timePeriod: today, country: 'India', state: 'Karnataka', city: 'Bangalore', impressions: 1800, clicks: 62, spend: 50.84, conversions: 4 },
        { timePeriod: today, country: 'India', state: 'Maharashtra', city: 'Mumbai', impressions: 1200, clicks: 40, spend: 32.80, conversions: 3 }
      ];
    case 'AgeGenderAudienceReport':
      return [
        { timePeriod: today, ageGroup: '25-34', gender: 'Female', impressions: 1600, clicks: 62, spend: 50.84, conversions: 4 },
        { timePeriod: today, ageGroup: '18-24', gender: 'Male', impressions: 1100, clicks: 38, spend: 31.16, conversions: 2 },
        { timePeriod: today, ageGroup: '35-44', gender: 'Female', impressions: 980, clicks: 32, spend: 26.24, conversions: 3 }
      ];
    case 'ConversionPerformanceReport':
      return [
        { timePeriod: today, goal: 'Purchase', goalType: 'Url', conversions: 11, revenue: 660, conversionRate: 3.8 },
        { timePeriod: today, goal: 'Sign Up', goalType: 'Event', conversions: 6, revenue: 0, conversionRate: 2.1 }
      ];
    default:
      return [];
  }
}

async function submitAndPollBingReport(
  accessToken: string,
  developerToken: string,
  report: BingReport,
  customerId: string,
  accountId: string
): Promise<{ rows: unknown[]; source: 'api' | 'mock' }> {
  try {
    const soapBody = buildSoapRequest(accessToken, developerToken, report, customerId, accountId);

    // Step 1: Submit report job
    const submitRes = await fetch(
      'https://reporting.api.bingads.microsoft.com/Api/Advertiser/Reporting/v13/ReportingService.svc',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'text/xml; charset=utf-8',
          SOAPAction: 'SubmitGenerateReport'
        },
        body: soapBody,
        signal: AbortSignal.timeout(30000)
      }
    );

    if (!submitRes.ok) {
      return { rows: getMockRows(report.reportType), source: 'mock' };
    }

    const submitText = await submitRes.text();
    const reportIdMatch = /<ReportRequestId>(.*?)<\/ReportRequestId>/.exec(submitText);
    if (!reportIdMatch) {
      return { rows: getMockRows(report.reportType), source: 'mock' };
    }

    const reportId = reportIdMatch[1];

    // Step 2: Poll for completion (max 3 attempts with 5s delay)
    for (let attempt = 0; attempt < 3; attempt++) {
      await new Promise((r) => setTimeout(r, 5000));

      const pollBody = `<?xml version="1.0" encoding="utf-8"?>
<s:Envelope xmlns:s="http://schemas.xmlsoap.org/soap/envelope/">
  <s:Header>
    <h:AuthenticationToken xmlns:h="https://bingads.microsoft.com/Reporting/v13">${accessToken}</h:AuthenticationToken>
    <h:DeveloperToken xmlns:h="https://bingads.microsoft.com/Reporting/v13">${developerToken}</h:DeveloperToken>
  </s:Header>
  <s:Body>
    <PollGenerateReportRequest xmlns="https://bingads.microsoft.com/Reporting/v13">
      <ReportRequestId>${reportId}</ReportRequestId>
    </PollGenerateReportRequest>
  </s:Body>
</s:Envelope>`;

      const pollRes = await fetch(
        'https://reporting.api.bingads.microsoft.com/Api/Advertiser/Reporting/v13/ReportingService.svc',
        {
          method: 'POST',
          headers: { 'Content-Type': 'text/xml; charset=utf-8', SOAPAction: 'PollGenerateReport' },
          body: pollBody,
          signal: AbortSignal.timeout(15000)
        }
      );

      const pollText = await pollRes.text();
      const statusMatch = /<ReportRequestStatus>(.*?)<\/ReportRequestStatus>/.exec(pollText);
      const status = statusMatch?.[1];

      if (status === 'Success') {
        const urlMatch = /<ReportDownloadUrl>(.*?)<\/ReportDownloadUrl>/.exec(pollText);
        if (urlMatch) {
          const csvRes = await fetch(urlMatch[1], { signal: AbortSignal.timeout(30000) });
          const csv = await csvRes.text();
          // Parse CSV to rows (simple split)
          const lines = csv.split('\n').filter(Boolean);
          const headers = lines[0]?.split(',') ?? [];
          const rows = lines.slice(1).map((line) => {
            const vals = line.split(',');
            return Object.fromEntries(headers.map((h, i) => [h.trim(), vals[i]?.trim()]));
          });
          return { rows, source: 'api' };
        }
      }

      if (status === 'Failed' || status === 'Expired') break;
    }

    return { rows: getMockRows(report.reportType), source: 'mock' };
  } catch {
    return { rows: getMockRows(report.reportType), source: 'mock' };
  }
}

export async function syncBingAccount(
  connectedAccountId: string,
  accessToken: string,
  accountId: string,
  customerId: string = '0'
): Promise<SyncResult[]> {
  const developerToken = process.env.BING_DEVELOPER_TOKEN ?? '';
  const results: SyncResult[] = [];

  for (const report of TIER1_REPORTS) {
    try {
      const { rows, source } = await submitAndPollBingReport(
        accessToken,
        developerToken,
        report,
        customerId,
        accountId
      );
      results.push({ reportType: report.reportType, rowCount: rows.length, source, rows } as SyncResult & { rows: unknown[] });
    } catch (e) {
      results.push({
        reportType: report.reportType,
        rowCount: 0,
        source: 'mock',
        error: e instanceof Error ? e.message : 'unknown'
      });
    }
  }

  return results;
}
