#!/usr/bin/env node
import { prepare, realPreparation } from "../prepare.js";

await prepare(realPreparation());
