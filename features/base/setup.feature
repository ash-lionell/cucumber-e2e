Feature: Setup scenarios

  @logon @data={logon}
  Scenario Outline: Perform login
    Given user a
    When user <=username>
    And user <=password>
    Then logged in
    |logon|
    |true |

    Examples:
    |=username|=password|
    |abc      |qwe      |
    |abc      |qwe      |