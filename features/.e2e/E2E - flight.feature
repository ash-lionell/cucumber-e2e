Feature: E2E - flight

@logon @data={logon}
Scenario Outline: Perform login
Given user a
When user <=username>
And user <=password>
Then logged in
|logon|
|true|
Examples:
|=username|=password|
|abc|qwe|
|abc|qwe|

@scenario2
Scenario: Module 1 Scenario 2
Given user a
|user|
|abe|


@scenario1
Scenario: Module 1 Scenario 1
Given user a