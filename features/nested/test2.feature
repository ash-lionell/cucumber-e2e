@feature
Feature: Test Feature

  @scenario
  Scenario Outline: Test Scenario
    Given user a
    When user b <B>
    #Then user c

    Examples:
    |B|
    |bb|