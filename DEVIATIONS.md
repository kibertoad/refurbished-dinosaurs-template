# Deviation log

Every place the rebuild departs from the spec in `spec/` on purpose, in the
format the
[documentation standard](https://dinorefurb.com/documentation-standard/#deviation-log)
sets out. Each deviation has a `## DEV-AREA-NNN` heading, using the spec's area
list, followed by the `Departs from`, `Reason`, `Setting`, `Default`,
`Justification` and `Dropped` items in that order. Default is `off`, `on` or
`mandatory` (Setting `None`), and Justification, which argues that the
rebuild's behavior is strictly better than the original's, is given for a
`mandatory` deviation and for one that is `on` without being the fix of an
unintended bug players do not rely on. IDs are never reused or renumbered, and
a dropped deviation keeps its heading.
