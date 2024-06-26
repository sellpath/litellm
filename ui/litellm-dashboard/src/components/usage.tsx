import { BarChart, BarList, Card, Title, Table, TableHead, TableHeaderCell, TableRow, TableCell, TableBody, Metric } from "@tremor/react";

import React, { useState, useEffect } from "react";

import ViewUserSpend from "./view_user_spend";
import { Grid, Col, Text, LineChart, TabPanel, TabPanels, TabGroup, TabList, Tab, Select, SelectItem, DateRangePicker, DateRangePickerValue } from "@tremor/react";
import {
  userSpendLogsCall,
  keyInfoCall,
  adminSpendLogsCall,
  adminTopKeysCall,
  adminTopModelsCall,
  adminTopEndUsersCall,
  teamSpendLogsCall,
  tagsSpendLogsCall,
  modelMetricsCall,
  modelAvailableCall,
  modelInfoCall,
} from "./networking";
import { start } from "repl";

interface UsagePageProps {
  accessToken: string | null;
  token: string | null;
  userRole: string | null;
  userID: string | null;
  keys: any[] | null;
}

type CustomTooltipTypeBar = {
  payload: any;
  active: boolean | undefined;
  label: any;
};


const customTooltip = (props: CustomTooltipTypeBar) => {
  const { payload, active } = props;
  if (!active || !payload) return null;

  const value = payload[0].payload;
  const date = value["startTime"];
  const model_values = value["models"];
  // Convert the object into an array of key-value pairs
  const entries: [string, number][] = Object.entries(model_values).map(
    ([key, value]) => [key, value as number]
  ); // Type assertion to specify the value as number

  // Sort the array based on the float value in descending order
  entries.sort((a, b) => b[1] - a[1]);

  // Get the top 5 key-value pairs
  const topEntries = entries.slice(0, 5);

  return (
    <div className="w-56 rounded-tremor-default border border-tremor-border bg-tremor-background p-2 text-tremor-default shadow-tremor-dropdown">
      {date}
      {topEntries.map(([key, value]) => (
        <div key={key} className="flex flex-1 space-x-10">
          <div className="p-2">
            <p className="text-tremor-content text-xs">
              {key}
              {":"}
              <span className="text-xs text-tremor-content-emphasis">
                {" "}
                {value ? (value < 0.01 ? "<$0.01" : value.toFixed(2)) : ""}
              </span>
            </p>
          </div>
        </div>
      ))}
    </div>
  );
};

function getTopKeys(data: Array<{ [key: string]: unknown }>): any[] {
  const spendKeys: { key: string; spend: unknown }[] = [];

  data.forEach((dict) => {
    Object.entries(dict).forEach(([key, value]) => {
      if (
        key !== "spend" &&
        key !== "startTime" &&
        key !== "models" &&
        key !== "users"
      ) {
        spendKeys.push({ key, spend: value });
      }
    });
  });

  spendKeys.sort((a, b) => Number(b.spend) - Number(a.spend));

  const topKeys = spendKeys.slice(0, 5).map((k) => k.key);
  console.log(`topKeys: ${Object.keys(topKeys[0])}`);
  return topKeys;
}
type DataDict = { [key: string]: unknown };
type UserData = { user_id: string; spend: number };


const UsagePage: React.FC<UsagePageProps> = ({
  accessToken,
  token,
  userRole,
  userID,
  keys,
}) => {
  const currentDate = new Date();
  const [keySpendData, setKeySpendData] = useState<any[]>([]);
  const [topKeys, setTopKeys] = useState<any[]>([]);
  const [topModels, setTopModels] = useState<any[]>([]);
  const [topUsers, setTopUsers] = useState<any[]>([]);
  const [teamSpendData, setTeamSpendData] = useState<any[]>([]);
  const [topTagsData, setTopTagsData] = useState<any[]>([]);
  const [uniqueTeamIds, setUniqueTeamIds] = useState<any[]>([]);
  const [totalSpendPerTeam, setTotalSpendPerTeam] = useState<any[]>([]);
  const [selectedKeyID, setSelectedKeyID] = useState<string | null>("");
  const [dateValue, setDateValue] = useState<DateRangePickerValue>({
    from: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), 
    to: new Date(),
  });

  const firstDay = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth(),
    1
  );
  const lastDay = new Date(
    currentDate.getFullYear(),
    currentDate.getMonth() + 1,
    0
  );

  let startTime = formatDate(firstDay);
  let endTime = formatDate(lastDay);

  console.log("keys in usage", keys);

  const updateEndUserData = async (startTime:  Date | undefined, endTime:  Date | undefined, uiSelectedKey: string | null) => {
    if (!startTime || !endTime || !accessToken) {
      return;
    }

    console.log("uiSelectedKey", uiSelectedKey);

    let newTopUserData = await adminTopEndUsersCall(
      accessToken,
      uiSelectedKey,
      startTime.toISOString(),
      endTime.toISOString()
    )
    console.log("End user data updated successfully", newTopUserData);
    setTopUsers(newTopUserData);
  
  }

  const updateTagSpendData = async (startTime:  Date | undefined, endTime:  Date | undefined) => {
    if (!startTime || !endTime || !accessToken) {
      return;
    }

    let top_tags = await tagsSpendLogsCall(accessToken, startTime.toISOString(), endTime.toISOString());
    setTopTagsData(top_tags.spend_per_tag);
    console.log("Tag spend data updated successfully");



  }

  function formatDate(date: Date) {
    const year = date.getFullYear();
    let month = date.getMonth() + 1; // JS month index starts from 0
    let day = date.getDate();

    // Pad with 0 if month or day is less than 10
    const monthStr = month < 10 ? "0" + month : month;
    const dayStr = day < 10 ? "0" + day : day;

    return `${year}-${monthStr}-${dayStr}`;
  }

  console.log(`Start date is ${startTime}`);
  console.log(`End date is ${endTime}`);

  const valueFormatter = (number: number) =>
    `$ ${new Intl.NumberFormat("us").format(number).toString()}`;

  useEffect(() => {
    if (accessToken && token && userRole && userID) {
      const fetchData = async () => {
        try {
          /**
           * If user is Admin - query the global views endpoints
           * If user is App Owner - use the normal spend logs call
           */
          console.log(`user role: ${userRole}`);
          if (userRole == "Admin" || userRole == "Admin Viewer") {
            const overall_spend = await adminSpendLogsCall(accessToken);
            setKeySpendData(overall_spend);
            const top_keys = await adminTopKeysCall(accessToken);
            const filtered_keys = top_keys.map((k: any) => ({
              key: (k["key_name"] || k["key_alias"] || k["api_key"]).substring(
                0,
                10
              ),
              spend: k["total_spend"],
            }));
            setTopKeys(filtered_keys);
            const top_models = await adminTopModelsCall(accessToken);
            const filtered_models = top_models.map((k: any) => ({
              key: k["model"],
              spend: k["total_spend"],
            }));
            setTopModels(filtered_models);

            const teamSpend = await teamSpendLogsCall(accessToken);
            console.log("teamSpend", teamSpend);
            setTeamSpendData(teamSpend.daily_spend);
            setUniqueTeamIds(teamSpend.teams)

            let total_spend_per_team = teamSpend.total_spend_per_team;
            // in total_spend_per_team, replace null team_id with "" and replace null total_spend with 0

            total_spend_per_team = total_spend_per_team.map((tspt: any) => {
              tspt["name"] = tspt["team_id"] || "";
              tspt["value"] = tspt["total_spend"] || 0;
              return tspt;
            })

            setTotalSpendPerTeam(total_spend_per_team);

            //get top tags
            const top_tags = await tagsSpendLogsCall(accessToken, dateValue.from?.toISOString(), dateValue.to?.toISOString());
            setTopTagsData(top_tags.spend_per_tag);

            // get spend per end-user
            let spend_user_call = await adminTopEndUsersCall(accessToken, null, undefined, undefined);
            setTopUsers(spend_user_call);

            console.log("spend/user result", spend_user_call);

          } else if (userRole == "App Owner") {
            await userSpendLogsCall(
              accessToken,
              token,
              userRole,
              userID,
              startTime,
              endTime
            ).then(async (response) => {
              console.log("result from spend logs call", response);
              if ("daily_spend" in response) {
                // this is from clickhouse analytics
                //
                let daily_spend = response["daily_spend"];
                console.log("daily spend", daily_spend);
                setKeySpendData(daily_spend);
                let topApiKeys = response.top_api_keys;
                setTopKeys(topApiKeys);
              } else {
                const topKeysResponse = await keyInfoCall(
                  accessToken,
                  getTopKeys(response)
                );
                const filtered_keys = topKeysResponse["info"].map((k: any) => ({
                  key: (
                    k["key_name"] ||
                    k["key_alias"]
                  ).substring(0, 10),
                  spend: k["spend"],
                }));
                setTopKeys(filtered_keys);
                setKeySpendData(response);
              }
            });
          }
        } catch (error) {
          console.error("There was an error fetching the data", error);
          // Optionally, update your UI to reflect the error state here as well
        }
      };
      fetchData();
    }
  }, [accessToken, token, userRole, userID, startTime, endTime]);


  return (
    <div style={{ width: "100%" }} className="p-8">
      <ViewUserSpend
            userID={userID}
            userRole={userRole}
            accessToken={accessToken}
            userSpend={null}
            selectedTeam={null}
          />
      <TabGroup>
        <TabList className="mt-2">
          <Tab>All Up</Tab>
          <Tab>Team Based Usage</Tab>
          <Tab>End User Usage</Tab>
           <Tab>Tag Based Usage</Tab>
        </TabList>
        <TabPanels>
          <TabPanel>
            <Grid numItems={2} className="gap-2 h-[75vh] w-full">
              <Col numColSpan={2}>
                <Card>
                  <Title>Monthly Spend</Title>
                  <BarChart
                    data={keySpendData}
                    index="date"
                    categories={["spend"]}
                    colors={["blue"]}
                    valueFormatter={valueFormatter}
                    yAxisWidth={100}
                    tickGap={5}
                    // customTooltip={customTooltip}
                  />
                </Card>
              </Col>
              <Col numColSpan={1}>
                <Card>
                  <Title>Top API Keys</Title>
                  <BarChart
                    className="mt-4 h-40"
                    data={topKeys}
                    index="key"
                    categories={["spend"]}
                    colors={["blue"]}
                    yAxisWidth={80}
                    tickGap={5}
                    layout="vertical"
                    showXAxis={false}
                    showLegend={false}
                  />
                </Card>
              </Col>
              <Col numColSpan={1}>
              <Card>
                  <Title>Top Models</Title>
                  <BarChart
                    className="mt-4 h-40"
                    data={topModels}
                    index="key"
                    categories={["spend"]}
                    colors={["blue"]}
                    yAxisWidth={200}
                    layout="vertical"
                    showXAxis={false}
                    showLegend={false}
                  />
                </Card>
               
              </Col>
              <Col numColSpan={1}>
                
              </Col>
            </Grid>
            </TabPanel>
            <TabPanel>
            <Grid numItems={2} className="gap-2 h-[75vh] w-full">
              <Col numColSpan={2}>
              <Card className="mb-2">
              <Title>Total Spend Per Team</Title>
                <BarList
                  data={totalSpendPerTeam}
                />
              </Card>
              <Card>

              <Title>Daily Spend Per Team</Title>
                <BarChart
                  className="h-72"
                  data={teamSpendData}
                  showLegend={true}
                  index="date"
                  categories={uniqueTeamIds}
                  yAxisWidth={80}
                  colors={["blue", "green", "yellow", "red", "purple"]}
                  
                  stack={true}
                />
              </Card>
              </Col>
              <Col numColSpan={2}>
              </Col>
            </Grid>
            </TabPanel>
            <TabPanel>
            <p className="mb-2 text-gray-500 italic text-[12px]">End-Users of your LLM API calls. Tracked when a `user` param is passed in your LLM calls <a className="text-blue-500" href="https://docs.litellm.ai/docs/proxy/users" target="_blank">docs here</a></p>
              <Grid numItems={2}>
                <Col>
                <Text>Select Time Range</Text>
       
              <DateRangePicker 
                  enableSelect={true} 
                  value={dateValue} 
                  onValueChange={(value) => {
                    setDateValue(value);
                    updateEndUserData(value.from, value.to, null); // Call updateModelMetrics with the new date range
                  }}
                />
                         </Col>
                         <Col>
                  <Text>Select Key</Text>
                  <Select defaultValue="all-keys">
                  <SelectItem
                    key="all-keys"
                    value="all-keys"
                    onClick={() => {
                      updateEndUserData(dateValue.from, dateValue.to, null);
                    }}
                  >
                    All Keys
                  </SelectItem>
                    {keys?.map((key: any, index: number) => {
                      if (
                        key &&
                        key["key_alias"] !== null &&
                        key["key_alias"].length > 0
                      ) {
                        return (
                          
                          <SelectItem
                            key={index}
                            value={String(index)}
                            onClick={() => {
                              updateEndUserData(dateValue.from, dateValue.to, key["token"]);
                            }}
                          >
                            {key["key_alias"]}
                          </SelectItem>
                        );
                      }
                      return null; // Add this line to handle the case when the condition is not met
                    })}
                  </Select>
                  </Col>

              </Grid>
            
                
                
              <Card className="mt-4">


             
              <Table className="max-h-[70vh] min-h-[500px]">
                  <TableHead>
                    <TableRow>
                      <TableHeaderCell>End User</TableHeaderCell>
                      <TableHeaderCell>Spend</TableHeaderCell>
                      <TableHeaderCell>Total Events</TableHeaderCell>
                    </TableRow>
                  </TableHead>

                  <TableBody>
                    {topUsers?.map((user: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell>{user.end_user}</TableCell>
                        <TableCell>{user.total_spend?.toFixed(4)}</TableCell>
                        <TableCell>{user.total_count}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>

              </Card>

            </TabPanel>
            <TabPanel>
            <Grid numItems={2} className="gap-2 h-[75vh] w-full mb-4">
            <Col numColSpan={2}>
            <DateRangePicker 
                  className="mb-4"
                  enableSelect={true} 
                  value={dateValue} 
                  onValueChange={(value) => {
                    setDateValue(value);
                    updateTagSpendData(value.from, value.to); // Call updateModelMetrics with the new date range
                  }}
              />

              <Card>
              <Title>Spend Per Tag</Title>
              <Text>Get Started Tracking cost per tag <a className="text-blue-500" href="https://docs.litellm.ai/docs/proxy/enterprise#tracking-spend-for-custom-tags" target="_blank">here</a></Text>
             <BarChart
              className="h-72"
              data={topTagsData}
              index="name"
              categories={["spend"]}
              colors={["blue"]}
             >

             </BarChart>
              </Card>
              </Col>
              <Col numColSpan={2}>
              </Col>
            </Grid>
            </TabPanel>
            
        </TabPanels>
      </TabGroup>
    </div>
  );
};

export default UsagePage;
