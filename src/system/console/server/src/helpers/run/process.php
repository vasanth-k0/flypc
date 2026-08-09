<?php

foreach (json_decode($argv[2]) as $key => $value) {
    $GLOBALS[$key] = $value;
}
require_once $argv[1];