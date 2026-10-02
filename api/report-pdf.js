import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
const JFD_LOGO_BASE64="/9j/4AAQSkZJRgABAQAAAQABAAD/2wBDAAwICQsJCAwLCgsODQwOEh4UEhEREiUbHBYeLCcuLisnKyoxN0Y7MTRCNCorPVM+QkhKTk9OLztWXFVMW0ZNTkv/2wBDAQ0ODhIQEiQUFCRLMisyS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0tLS0v/wgARCACZAPoDASIAAhEBAxEB/8QAGgABAAMBAQEAAAAAAAAAAAAAAAMEBQYCAf/EABgBAQEBAQEAAAAAAAAAAAAAAAACAQME/9oADAMBAAIQAxAAAAHqgAAAAEfP5vSOUhnexVecqetcnHF9g5vaqbTCn3NZUt6AAAAAPGSbIMv1nVOXTrlG9154VHb57j06PKres3ep3aXblmaeZV8/b3erblZ8xdTMzfPyx96Q6LkeqqZfXH6Obvqlu5A8Ym3RxiW6Lz9uvfPvp48h9rz8enrpOakmt+na5Xrz3su3RmtCzZwrj5vc/d5X0JU788vOmi83b3reLHbnfZ8NTjSfbPm7w2PdG56v7l6nbkI9YlHSy/P22tLBuduWH1WRrHO2OiGZLe8bkUuNj63fPPeazuJOH1Z3o4fsplVd9m8nV7b5O1sHUyMR/JLPO6UvnrdV7B35MrVY4qXqJoupdOkAAM3S5nEPrN0qU5LENz8uxTcO9jb5XqNn0KgACpV1WOL66H5NXRcgAAAAOH7jHOa1NKG8oz07mX4sfJourr5m9mehXMAAAAAAAAABm6UeOZ+3vEdoLsVbak8R2cibahmvkGgAAAAAFexzE7vuahzerc3aNr7y3vN62vkVtzf+8tKa0W3ibl61yqK6qKjhVnV++R1NzX9cr8iuui5n1WdJJzF03hcgAMHe5aKrb2P0ObiaeJZza8fz1FasdL7U1ugwmuxzdLD6c6k9D1w7aOVt4O5P0nM2OkQ/Yd6KsUNvmbmxu8vbzd5madwGgEUoik+iH7KIffsQphD9lCOQQy/R5jmEPqQQ+/YRSiL17Hz6AH//xAAqEAACAgEEAAUEAwEBAAAAAAACAwEEAAUREhMQFCAhNCIyM0AjMDFQJP/aAAgBAQABBQL/AJTDFYOusnJbaHHOY9QbnWaqxXj6shreIWnhiHi8T1CQdF8MCyln6F55qipZ7vHUZ/kCetwW0nl9HEqe/ldU/BlHbyKPxU/a7qPxMWg7JEt1bPOPXhFAiJQUesiEIPUVwfhenlcmJ3q2O8cuV+8OfEv9wCNWVnw8NT/BgmXSMMPKlbpzUp+jKlgE1NPEjZTHtsOULl8JRZC2wMVYW30EUALdQ953KdN4wzws7stfUB/UJIcL12jJVesyLInpwZsa2af8nU/wT/lH4nhfnew0uKzWSD0wdq3GNyKBFcyWQHc21V8vCbRKyPeMMYMPJJ6Q3zn0t8Ocwc91oomeQHKGdi7CgZAAOpe0sOy2pX8utp2XZPPKb2wWPsAjGH2vmOTdQrsfjGjVTRebw1I/4comsDvvFgZpxb1/G+vgyY3jTmcknPEKcgBKaDhb32HjTeWV6cJYmopJShUz7BDL4xg6hGAYsHwYoGxOnpw9PLaaz1ZPvK+tA2D7bRRJZw6mTPGRW9uIVCVeDDFYHbU6B3jKHyr4uMF0TnEpBMeJFADcNkYbSkZz3jIYa5qm9jQYDPTtGWqUWCJD0ZWcobF2NrW/E/RqIkSjIWL5G9tWv5dfqv8A4KzpWL0QEQkuPlzjK6SbJzJr072P1trKdN9RGBTDFpPsV6CQopiIGPXdcRltAEj6FsF7cmGJnlBh509ocwHDMFH9D6y35Vr+XD+2RLPbLXshBysIkDOnAyQ3hADvSwaXxf1y/wDK7ao3Ngs10zK2WD54vjWr9tVWGfm5GIEf17/4FI7Tc8cW4jwUsKDKENlQBlDj2/sGAsG0JRMMSGHfgc2tWcAVASOyLC1Ar9HvVnenO9Wd6c71Z3pyHKnw71Z3pzsUzJpcSNXus66xEhLCIQjvTnenO0OPenBassIxDO9Od6cEwP8AosoFLhWJYqINpqFTq1Rbw4xEkjgikcg16AS+RjjU+TmoJHjC+bJXKmhtdTEfxmHEqawfW4xGde2NbMpYiVYpHczTPcvXf/PP+0IjosfL0/8ABP3gUsDT175e+TP3JNS6+ah8VXyb3yqH5Y+yt8hZq5T9ykuOKyOkNQ++j8j+izYBzlNXuAjVQbgY6tdWgOwZmJggVYhLHWQe3sDjE9p5qLx2hogyWE9o7UUQQ8O4edRgpzmM5QeLF5bsAxtewCXXzLtoGRK9XWGdYZ/udS86gzqXkAI51LzqXnUvIWEeEgJZ1LyIiMmILOpedS84Dt1LyBEfDrDOoMIBOIiIj/h//8QAJBEAAgIBBAICAwEAAAAAAAAAAAECESEQEiAxA0EwMiJAQlH/2gAIAQMBAT8B4pWbdHChpor4VC1pCqpmxrrTyEmqo8ZY69G198JK440TokryhKyNo7ZN3osRG70liJFblnWD9D7HRueu7W2biNXkv8icmtXPinZg8cHLKJpp8ZSvnV4HBrs34yeJf6rJ16VfKpbnc8j8fvodR+rH8CVlFYs2m3NFFm3NCjem0oarhHskx/Uvo/olnR/ayLyMbpIj2PMv0//EACURAAICAQMEAgMBAAAAAAAAAAABAhESECExAyAiMjBBE0BCUf/aAAgBAgEBPwHtboyrRTT4FJPgv4ZTqVaTtPJH5U9mfR0nRCLys6wkuCN1uZq6erINqW+jSkQli8WN0TSkjhHSTXOkvKYo070h5SsnLF7a9Vf0hO0Rv7HFPnTkwY9tKRgTutjHwOnFNXqunW3a41weRJ77keO2Mce+63M1khw8rR1H5bC+Wq2LORfA3SsUrFLejPky8bFIoz2slKtyzMy+xSvsn6kFsR92U3dF+BHYYvSiaqKQv8Iq2yXqRdR/T//EADgQAAEDAwEFBQYFBAMBAAAAAAEAAhEDEiExECIyQVETM2FxkSAwUnKBkgQjQEKhUGKComOx0cH/2gAIAQEABj8C/pRc4wAsbgOgiXFXEVwPJT2nCDw4TYOSxNNSoSCYw8rvKn3K+6tZMXTK4hUHipbqNR0TmGngGBmJW+x7fpK3ajf0DG04DnlWvxUGo67aLOWSm1YujkuK09HYXaUmk34cGhUrhBtTfnGzOm8mrHNmVU8cbKltsN+ILN1MdWukIXW1Mx0KucYAUtII8PcS4gDxTWtBMnXa0fCxBzTDhoVnD28Q2C3D25aragsd0Oz8p0eHJTEEYITfnGwU7qhp9AzVRTou+ogIucZqO1VNvxP2EyDUeSbVVD3FzYgieapM5U5JRY6YPRPpsecDULfAePQqGne6HX2C5xgBW0oHi5XPJcfFVWkfmTM+G2rByXBgRp1MPH8oPZxj+Vc36jonvZq0JzK4a5w8OS/Kc6mfUI06nEMyOaq9LQm/ONlL5dtMfC0lEjVWvjImQr+bzcpgSi46BOqHV5lMpdcu8leDdS5g6tUVDdT68xtLXaFGmGDPPmi13E3BTK3TDvLb2ot7wuygYc+NIFoRa8WvbqF2jcj9w6pzWPBuboqbrrXjms2HxuhEsF7zjGgUTLjlxQFSk6AZ3WLuav2qnRNPd6lpGxt873ROqCYwBKpNOhemmlGARqmtGXRDWoueBgwCOaFMa1DH02PdUda44E9F2NM3F2schsj4XED2G1ho7dcoKsdxU8InoFTdVgNtOvVTTMjRT2PBIx/6t5zGfyr73OdEJzmjLuqk02ei5ALcaXDroELqZAPMGVc0yNsVGh3mt25nk5btUO8HtXA6P+N6sYD2j8Z1TKVwGMJx/azdCDG8TzCqUuTTjyQDWEz8KhlIt/ucgxvLaXPMAI06jHNa/ElFruJpgqrGlolBtLIdhy/MfaOjFDBr7FzjATX03nsiNWr8xxdnhJW/dY7ICtfryzot0u8280N91o4pW44Ojp7V95a6I8Fll7erP/Fe84AjyTXDR7VTf8Lh7LS0Ta6SEYcE4023Pd00CiZccuPt/wCQWRNImC1doyH0nDB6I3N8lY4c8kZKiYa3V3wrs/w7D2I/2VYHBx7iXsBPVMcxtxYdE4DXomO6j2ZdTYT5KAIHuDbw0z/KBcbpE4Kufw/Chh0KXTHXkv7RxN6qKdMALti35sahAjQ+53hvfENUW3XSZ99mQw6lOYBcScFUxBCBa/JMWKPxDjDRgKpukt5IAM0RbYIPiqXl+oM91U/gr9n/AEnU2nNM4UtbJGqDCCGjTGpTpO87XwWGz9EKVJtoPEfBADQfqP8AII2mKQ1emtpCKbdPFYpyfBCWgY5rDhUBEOahVaO0oH/VVy3TEfqbXCQm0203diOTV+Z+HLPEhRTZ6rOG+gUBrqzh0GFuUXNpu4gdEbGhs/oe8Z6rvWfcu8Z6rvWfcu9Z6rvWfcsVGeuzvWeq71n3K29jp5SppVCz6Sor/i/porWPYB5rdIPkpcQB4rvWfcu9Z9yuvbb1ld6z7luvafIrecB5rvWfcu9Z9y3HB3kfcNt/cCTKquc4tDBOAmMOhP1T2DQRqi58zJGE8fC4hUqs3X6ghdn+1w06INboROU90ndgABUgYnX+NnbZuwExmlxRbMOGjgraurTmEfCU1rd51s5VRp4S/knj4SQm3ZuZdomh+bH/APxUrjJfqITgDbDZ0VXEae4p/KU7isxcgYzJVX6I/MVV+cpu8SGaBGqTvaR0TPkRwY/iVRdUtBLcHYfMKl5pvyKp5BO+qpyDM5nyRp07ZGoCq/OUCGE4gFx5KDlxySqP1T/l9yCMWyMp7HZFWG4R1IblPqTAMaotdJzOE8yBc4lB1MG6m3f8VeCCDxCUHjADYyntOQ6NHKk2RiGtE7Ox/dgpjwQbTpKLgLnHQN5K6pkuOYR3hmeaY8CHtEZdhVap3gIGE8yBcSUKY1YBOxoGOzmZRJzcIwmtLi1keqMmQDg+3wN9FwN9NnA30XA30WGgfRcDfRcDfRcDfRYY302ZaD9FwN9FgLIlcDfRcDfRRaI8lwN9FugDZwN9FwN9FDmgjxUDA/on/8QAKhABAAICAQIEBgMBAQAAAAAAAQARITFBUWEQcYHxIDHR4VD/2gAIAQEAAT8h/wDK50ylJvKKAN3QS/apaNihlZ7zVgVPeoJdl7lz97g1TC0EoHs4p+pM3hKfam9ah/qT/Od9pjlPRafp/AZVAWl0BKyR/wB4PF1m/qpqKNio+bpGA+tErigbZxhgAIAEd+LzY71N9LZbP0iaNG+/EQXAoB5rAoCXEuhVtsyPuuTiGqKBiCMRLV4lnK5V/IcnXKqC5yOHrW/Hond6rOYDnxDUGt/advBrUXY/ibmP9RiAzSR20HXl+kRm27N8fr7gR90rke9F9ZVK3BoOhPL4+hnwDZaBzfEIhSqwrc5k+gsE6z7tUWh1OpOz1mO6iPYj+D5L4Bwt5eIbvn7BPOy+Hl0lbbgvavFA1InSYD+wPUlrdaeg6MIYnSbXSVwZhZM3Rc7LTM96aH7DEhlFNA6xOHqfPwvgvKCvLePuaGInFGPOAL+GVX1JlG3/AIgLJLbWYztDbOZOf9TaNPB0Rr2T+QDKdHW/qkQCNjp8D2s6SUige+3W5Tyf15g2n6iDZZp8LBOqcQu7vKl9WZDRCuqmD4dfOK2aYOfpLQSYG/aKY36PwSmvqUx+cC1b9yzj38ma1m5gR+pj1qlXAA8CVtUUuV0DKKmiAkAF32zMlNhdN1KugANsD3ICYW90QKKNEF0vhHqld6C6shWKjXsnlL4KsfmeGE2hKYt9lv3OJaekY/8AYLGLR5VHhU2uKGlCd1NWPbOd3RKCMy5LXLIT1TKxQfoEyelXYdg4gEBvpPE8ENU1G/lUxQHcfcn3BNX0lKMbW/lNOvAtLKNbH1OZ0nD26sDv9h1Syx1BFMz3hCZ9jk8vXx5UiZiKUIrt5T9z1uX/AOhIb9qkw15wUrH9rYvpWtVtfgfDPax7lQOe8HI2L/VizYF1z6Slq1BsWSIWrqnOZy5R284aoCpt8KiKCmnpClFo5p5QihGIzUosb94PHn6nvHvhPlr4VqVickGM/qwLCpfT9WFsP3L8bx7/AJIoS/2kEoxQO9h9ghddRfTqjhHaZQ7Rodu84c5YfqoE3TmenyDgw9jGlWtN1WZeME2wjAFbrfh7voTKwugFfIrS4l/lCnp2Ext/k3ml9yIrSoTVekupno5I2ZfANeTvAgSaMseJOiwf6RS7Cx+SNdY1gEK8JEvzn02iq8GeYVoKCYqjYyuHHEoiq/0lF7oMZ51k2RF6inNRAkNXF838imotLg5SW+qPIGLyS/EWCcQaj1LNCUTN1hpNImdL/mco2o1Ap0FH8g2O35IF32bHoRHA+u/+ZXC5sjtOCJKrZ39seO09bhZ/4lnIB5P5LAT7GNPBaO+zFb82c/yC+02G9+HNRmpNsbj/AFQoEK2v4KLSSds9oQXX0s9oT2zPaEUpXp8PbM9oQxvYBuD2MDQeU6LdKXgsv4DBbF7rnfDSqe0J7QgqFDDRU9oRGlegMKsl5VT2hPaEvcNvJ8gKuhDLNwQA9CzudD9tAjJMh+Ns6nVqoohVNgC7lgVUAMX0lRrcTqEuRVoyzctsLEDNxIaNFGxXhfavJirgHOooHSN/Z4Nk3sb7WeGEYBdldJYFQOhWrqXI5XDghgt0i7xNOlYuCRCnWXktUZQgWhRMl6phSx8gwTvn5H7TtL2Uhocdri2BGeu7P0e0/RdZ+p6wTd2wKgVZyJn7x+ZvOQZvgxG0GCGfD9p1J97/AAz+w+sv283nmc7V/mzVBzNta/aWcGtVU/U9YG4SEA4QVQbhcz93yn2n8wA0fIwmSmJm4F9ACzH7cEhLUu+sFAxQi8ECpr2qkMEwBeso4gHgdSa8yHbv5ztW4nM53qEhEgo1IG1F58LfO2RqquZwCYDiaD7ygec3v6rysIv3ExGFsOhV1CnoEdlWDcEQXrAIa7o8L2rCqEwxQFzdwjQXKatLlq1uT479/QwNsB8kQFJYz2PPZs9jy4zW6j2LPY89jxCwJyDwetrq2nsWA0AdiGUQ6Jc9jz2PA0L2yPYs5xOhXgu2ovZPZs7SSFwEAGg/8T//2gAMAwEAAgADAAAAEPPPPPMPv8tcePPPPPNPENAYNZwcHnVPPJR/BUDhDR/DRhzvtuHJhXftZubPKD0xfP5HPPL3Gg1PPPD4PPPPPPOUSaoPPPPPPPPPPPP0RT//ADzzzzzzpIAoDJNOE5I4rzzzpiSyqQtKLRErDfzyxyyzzzyzyzzwxzz/xAAjEQEAAwEAAgEDBQAAAAAAAAABABEhMRAgMEBBUWFxgZGx/9oACAEDAQE/EPVOIJ5AtqJ0zqS1X8OydnIkpOxQ7BdTNbDixaq8m0XFPIh2BZ4NX8QzIgxLrkvWFSnx3xQEranES8hzwxuCkRpyAFEW40FspfIUlj4A4wRGLRs/iIUeBpuIt1voZsEbGn2glNhHd+g03MK++EBoKgcC2uw0pf2R2rB8g03B/pksbAf1Y0tv8itv4LlRIpcai3Ygrey28SKXBOLH7zZcSIVdz7d7DdLsOxfpzmyTnKBaAm4FMOz+FLGwLrGoTRYbCJTX0X//xAAhEQEAAgICAgIDAAAAAAAAAAABABEhMRAgQWEwUUCR8P/aAAgBAgEBPxDqO0TtFouaUzcogaXvfGWag3CWBgMW4yGXTKiyEEAw8AhoMG+Aphik4mJ5uPBdEwAzAwy1BxQSAwigXNlKL9oNl8A1CpYAQtYuAELVBMW4FUnC2yIXbC2CFX97lub4SyoAyx0S8HmMyC3mJYhGH10SymZwa7lpAiTYKIKlS6rfyJZUaKY9wx3cPBIKK+C6hANbljrqCcDUrhiINbiAuoXx4lMGbgrpJ541HChirjEa302SoPqbEsf0xCwIwHupoy+LcSAwaZgnYaQSpXxBsv8AC//EACoQAQABAwMDBAICAwEAAAAAAAERACExQVFhcYGhkbHB8BAgMNFA4fFQ/9oACAEBAAE/EP8AyhfBlPgDVdqWRsBmew8Q9ahZd0mHNDA7phUC8HJHmmg13OFaz1pjWw8LCjaLUIwX33oPJxEKMM5Q6lYJCY7HFr1Kc6CJ2z8OtHzUyRDUmHmrMQ1WB3TTgq/7ohoRJGR/n1ZJTgWPShFjsYHtPj8rYzMaCD0StDjnKwxqTaSo0m0/cs9lqTQyElUIejQZPzgIRcr6bdrWgxuyLIntQF5tnbTxRzORMWEn1Sh6QBJsA964sAokGbgGJblyLUoX1E6Xk9xRqhYXSsEJI+lT6KNYdaPYwED3P4M7FiDzTVWrIAuCuOx+Ygup8QvYpSt+oLZ3HUosUKRh03Fp+H7RaS6rhKZVuyEDzgSoOF6JI0ECtd4GzqRTwJZMvW1HI19tu02o23FBgKqIFSWthLO6D8KWN3jWWOI81MHKBwq8xSgK4LtCke8tMSDBAMulNvGFL1Q2xbvUgOa9JovilTBGQszntQEAtpzsWs3KjhvbHtl4rlBji7OepP6FxiXwCrmKwtz5Xqx3oQU8PPYx2FEBQCTggdAff8p6L3VYX1WiOY5k6DiqA/Wuo4nxU5kmjPKoz3mUQJNuk0rUrDjGDw9K6pkuOYR3hmeaY8CHtEZdhVap3gIGE8yBcSUKY1YBOxoGOzmZRJzcIwmtLi1keqMmQDg+3wN9FwN9NnA30XA30XA30WGgfRcDfRcDfRcDfRYY302ZaD9FwN9FgLIlcDfRcDfRRaI8lwN9FugDZwN9FwN9FDmgjxUDA/on/8QAKhABAAICAQIEBgMBAQAAAAAAAQARITFBUWEQcYHxIDHR4VD/2gAIAQEAAT8h/wDK50ylJvKKAN3QS/apaNihlZ7zVgVPeoJdl7lz97g1TC0EoHs4p+pM3hKfam9ah/qT/Od9pjlPRafp/AZVAWl0BKyR/wB4PF1m/qpqKNio+bpGA+tErigbZxhgAIAEd+LzY71N9LZbP0iaNG+/EQXAoB5rAoCXEuhVtsyPuuTiGqKBiCMRLV4lnK5V/IcnXKqC5yOHrW/Hond6rOYDnxDUGt/advBrUXY/ibmP9RiAzSR20HXl+kRm27N8fr7gR90rke9F9ZVK3BoOhPL4+hnwDZaBzfEIhSqwrc5k+gsE6z7tUWh1OpOz1mO6iPYj+D5L4Bwt5eIbvn7BPOy+Hl0lbbgvavFA1InSYD+wPUlrdaeg6MIYnSbXSVwZhZM3Rc7LTM96aH7DEhlFNA6xOHqfPwvgvKCvLePuaGInFGPOAL+GVX1JlG3/AIgLJLbWYztDbOZOf9TaNPB0Rr2T+QDKdHW/qkQCNjp8D2s6SUige+3W5Tyf15g2n6iDZZp8LBOqcQu7vKl9WZDRCuqmD4dfOK2aYOfpLQSYG/aKY36PwSmvqUx+cC1b9yzj38ma1m5gR+pj1qlXAA8CVtUUuV0DKKmiAkAF32zMlNhdN1KugANsD3ICYW90QKKNEF0vhHqld6C6shWKjXsnlL4KsfmeGE2hKYt9lv3OJaekY/8AYLGLR5VHhU2uKGlCd1NWPbOd3RKCMy5LXLIT1TKxQfoEyelXYdg4gEBvpPE8ENU1G/lUxQHcfcn3BNX0lKMbW/lNOvAtLKNbH1OZ0nD26sDv9h1Syx1BFMz3hCZ9jk8vXx5UiZiKUIrt5T9z1uX/AOhIb9qkw15wUrH9rYvpWtVtfgfDPax7lQOe8HI2L/VizYF1z6Slq1BsWSIWrqnOZy5R284aoCpt8KiKCmnpClFo5p5QihGIzUosb94PHn6nvHvhPlr4VqVickGM/qwLCpfT9WFsP3L8bx7/AJIoS/2kEoxQO9h9ghddRfTqjhHaZQ7Rodu84c5YfqoE3TmenyDgw9jGlWtN1WZeME2wjAFbrfh7voTKwugFfIrS4l/lCnp2Ext/k3ml9yIrSoTVekupno5I2ZfANeTvAgSaMseJOiwf6RS7Cx+SNdY1gEK8JEvzn02iq8GeYVoKCYqjYyuHHEoiq/0lF7oMZ51k2RF6inNRAkNXF838imotLg5SW+qPIGLyS/EWCcQaj1LNCUTN1hpNImdL/mco2o1Ap0FH8g2O35IF32bHoRHA+u/+ZXC5sjtOCJKrZ39seO09bhZ/4lnIB5P5LAT7GNPBaO+zFb82c/yC+02G9+HNRmpNsbj/AFQoEK2v4KLSSds9oQXX0s9oT2zPaEUpXp8PbM9oQxvYBuD2MDQeU6LdKXgsv4DBbF7rnfDSqe0J7QgqFDDRU9oRGlegMKsl5VT2hPaEvcNvJ8gKuhDLNwQA9CzudD9tAjJMh+Ns6nVqoohVNgC7lgVUAMX0lRrcTqEuRVoyzctsLEDNxIaNFGxXhfavJirgHOooHSN/Z4Nk3sb7WeGEYBdldJYFQOhWrqXI5XDghgt0i7xNOlYuCRCnWXktUZQgWhRMl6phSx8gwTvn5H7TtL2Uhocdri2BGeu7P0e0/RdZ+p6wTd2wKgVZyJn7x+ZvOQZvgxG0GCGfD9p1J97/AAz+w+sv283nmc7V/mzVBzNta/aWcGtVU/U9YG4SEA4QVQbhcz93yn2n8wA0fIwmSmJm4F9ACzH7cEhLUu+sFAxQi8ECpr2qkMEwBeso4gHgdSa8yHbv5ztW4nM53qEhEgo1IG1F58LfO2RqquZwCYDiaD7ygec3v6rysIv3ExGFsOhV1CnoEdlWDcEQXrAIa7o8L2rCqEwxQFzdwjQXKatLlq1uT479/QwNsB8kQFJYz2PPZs9jy4zW6j2LPY89jxCwJyDwetrq2nsWA0AdiGUQ6Jc9jz2PA0L2yPYs5xOhXgu2ovZPZs7SSFwEAGg/8T//2gAMAwEAAgADAAAAEPPPPPMPv8tcePPPPPNPENAYNZwcHnVPPJR/BUDhDR/DRhzvtuHJhXftZubPKD0xfP5HPPL3Gg1PPPD4PPPPPPOUSaoPPPPPPPPPPPP0RT//ADzzzzzzpIAoDJNOE5I4rzzzpiSyqQtKLRErDfzyxyyzzzyzyzzwxzz/xAAjEQEAAwEAAgEDBQAAAAAAAAABABEhMRAgMEBBUWFxgZGx/9oACAEDAQE/EPVOIJ5AtqJ0zqS1X8OydnIkpOxQ7BdTNbDixaq8m0XFPIh2BZ4NX8QzIgxLrkvWFSnx3xQEranES8hzwxuCkRpyAFEW40FspfIUlj4A4wRGLRs/iIUeBpuIt1voZsEbGn2glNhHd+g03MK++EBoKgcC2uw0pf2R2rB8g03B/pksbAf1Y0tv8itv4LlRIpcai3Ygrey28SKXBOLH7zZcSIVdz7d7DdLsOxfpzmyTnKBaAm4FMOz+FLGwLrGoTRYbCJTX0X//xAAhEQEAAgICAgIDAAAAAAAAAAABABEhMRAgQWEwUUCR8P/aAAgBAgEBPxDqO0TtFouaUzcogaXvfGWag3CWBgMW4yGXTKiyEEAw8AhoMG+Aphik4mJ5uPBdEwAzAwy1BxQSAwigXNlKL9oNl8A1CpYAQtYuAELVBMW4FUnC2yIXX97lub4SyoAyx0S8HmMyC3mJYhGH10SymZwa7lpAiTYKIKlS6rfyJZUaKY9wx3cPBIKK+C6hANbljrqCcDUrhiINbiAuoXx4lMGbgrpJ541HChirjEa302SoPqbEsf0xCwIwHupoy+LcSAwaZgnYaQSpXxBsv8AC//EACoQAQABAwMDBAICAwEAAAAAAAERACExQVFhcYGhkbHB8BAgMNFA4fFQ/9oACAEBAAE/EP8AyhfBlPgDVdqWRsBmew8Q9ahZd0mHNDA7phUC8HJHmmg13OFaz1pjWw8LCjaLUIwX33oPJxEKMM5Q6lYJCY7HFr1Kc6CJ2z8OtHzUyRDUmHmrMQ1WB3TTgq/7ohoRJGR/n1ZJTgWPShFjsYHtPj8rYzMaCD0StDjnKwxqTaSo0m0/cs9lqTQyElUIejQZPzgIRcr6bdrWgxuyLIntQF5tnbTxRzORMWEn1Sh6QBJsA964sAokGbgGJblyLUoX1E6Xk9xRqhYXSsEJI+lT6KNYdaPYwED3P4M7FiDzTVWrIAuCuOx+Ygup8QvYH3HUosUKRh03Fp+H7RaS6rhKZVuyEDzgSoOF6JI0ECtd4GzqRTwJZMvW1HI19tu02o23FBgKqIFSWthLO6D8KWN3jWWOI81MHKBwq8xSgK4LtCke8tMSDBAMulNvGFL1Q2xbvUgOa9JovilTBGQszntQEAtpzsWs3KjhvbHtl4rlBji7OepP6FxiXwCrmKwtz5Xqx3oQU8PPYx2FEBQCTggdAff8p6L3VYX1WiOY5k6DiqA/Wuo4nxU5kmjPKoz3mUQJNuk0rUrDjGDw9K6pkuOYR3hmeaY8CHtEZdhVap3gIGE8yBcSUKY1YBOxoGOzmZRJzcIwmtLi1keqMmQDg+3wN9FwN9NnA30XA30XA30WGgfRcDfRcDfRcDfRYY302ZaD9FwN9FgLIlcDfRcDfRRaI8lwN9FugDZwN9FwN9FDmgjxUDA/on/8QAKhABAAICAQIEBgMBAQAAAAAAAQARITFBUWEQcYHxIDHR4VD/2gAIAQEAAT8h/wDK50ylJvKKAN3QS/apaNihlZ7zVgVPeoJdl7lz97g1TC0EoHs4p+pM3hKfam9ah/qT/Od9pjlPRafp/AZVAWl0BKyR/wB4PF1m/qpqKNio+bpGA+tErigbZxhgAIAEd+LzY71N9LZbP0iaNG+/EQXAoB5rAoCXEuhVtsyPuuTiGqKBiCMRLV4lnK5V/IcnXKqC5yOHrW/Hond6rOYDnxDUGt/advBrUXY/ibmP9RiAzSR20HXl+kRm27N8fr7gR90rke9F9ZVK3BoOhPL4+hnwDZaBzfEIhSqwrc5k+gsE6z7tUWh1OpOz1mO6iPYj+D5L4Bwt5eIbvn7BPOy+Hl0lbbgvavFA1InSYD+wPUlrdaeg6MIYnSbXSVwZhZM3Rc7LTM96aH7DEhlFNA6xOHqfPwvgvKCvLePuaGInFGPOAL+GVX1JlG3/AIgLJLbWYztDbOZOf9TaNPB0Rr2T+QDKdHW/qkQCNjp8D2s6SUige+3W5Tyf15g2n6iDZZp8LBOqcQu7vKl9WZDRCuqmD4dfOK2aYOfpLQSYG/aKY36PwSmvqUx+cC1b9yzj38ma1m5gR+pj1qlXAA8CVtUUuV0DKKmiAkAF32zMlNhdN1KugANsD3ICYW90QKKNEF0vhHqld6C6shWKjXsnlL4KsfmeGE2hKYt9lv3OJaekY/8AYLGLR5VHhU2uKGlCd1NWPbOd3RKCMy5LXLIT1TKxQfoEyelXYdg4gEBvpPE8ENU1G/lUxQHcfcn3BNX0lKMbW/lNOvAtLKNbH1OZ0nD26sDv9h1Syx1BFMz3hCZ9jk8vXx5UiZiKUIrt5T9z1uX/AOhIb9qkw15wUrH9rYvpWtVtfgfDPax7lQOe8HI2L/VizYF1z6Slq1BsWSIWrqnOZy5R284aoCpt8KiKCmnpClFo5p5QihGIzUosb94PHn6nvHvhPlr4VqVickGM/qwLCpfT9WFsP3L8bx7/AJIoS/2kEoxQO9h9ghddRfTqjhHaZQ7Rodu84c5YfqoE3TmenyDgw9jGlWtN1WZeME2wjAFbrfh7voTKwugFfIrS4l/lCnp2Ext/k3ml9yIrSoTVekupno5I2ZfANeTvAgSaMseJOiwf6RS7Cx+SNdY1gEK8JEvzn02iq8GeYVoKCYqjYyuHHEoiq/0lF7oMZ51k2RF6inNRAkNXF838imotLg5SW+qPIGLyS/EWCcQaj1LNCUTN1hpNImdL/mco2o1Ap0FH8g2O35IF32bHoRHA+u/+ZXC5sjtOCJKrZ39seO09bhZ/4lnIB5P5LAT7GNPBaO+zFb82c/yC+02G9+HNRmpNsbj/AFQoEK2v4KLSSds9oQXX0s9oT2zPaEUpXp8PbM9oQxvYBuD2MDQeU6LdKXgsv4DBbF7rnfDSqe0J7QgqFDDRU9oRGlegMKsl5VT2hPaEvcNvJ8gKuhDLNwQA9CzudD9tAjJMh+Ns6nVqoohVNgC7lgVUAMX0lRrcTqEuRVoyzctsLEDNxIaNFGxXhfavJirgHOooHSN/Z4Nk3sb7WeGEYBdldJYFQOhWrqXI5XDghgt0i7xNOlYuCRCnWXktUZQgWhRMl6phSx8gwTvn5H7TtL2Uhocdri2BGeu7P0e0/RdZ+p6wTd2wKgVZyJn7x+ZvOQZvgxG0GCGfD9p1J97/AAz+w+sv283nmc7V/mzVBzNta/aWcGtVU/U9YG4SEA4QVQbhcz93yn2n8wA0fIwmSmJm4F9ACzH7cEhLUu+sFAxQi8ECpr2qkMEwBeso4gHgdSa8yHbv5ztW4nM53qEhEgo1IG1F58LfO2RqquZwCYDiaD7ygec3v6rysIv3ExGFsOhV1CnoEdlWDcEQXrAIa7o8L2rCqEwxQFzdwjQXKatLlq1uT479/QwNsB8kQFJYz2PPZs9jy4zW6j2LPY89jxCwJyDwetrq2nsWA0AdiGUQ6Jc9jz2PA0L2yPYs5xOhXgu2ovZPZs7SSFwEAGg/8T//2gAMAwEAAgADAAAAEPPPPPMPv8tcePPPPPNPENAYNZwcHnVPPJR/BUDhDR/DRhzvtuHJhXftZubPKD0xfP5HPPL3Gg1PPPD4PPPPPPOUSaoPPPPPPPPPPPP0RT//ADzzzzzzpIAoDJNOE5I4rzzzpiSyqQtKLRErDfzyxyyzzzyzyzzwxzz/xAAjEQEAAwEAAgEDBQAAAAAAAAABABEhMRAgMEBBUWFxgZGx/9oACAEDAQE/EPVOIJ5AtqJ0zqS1X8OydnIkpOxQ7BdTNbDixaq8m0XFPIh2BZ4NX8QzIgxLrkvWFSnx3xQEranES8hzwxuCkRpyAFEW40FspfIUlj4A4wRGLRs/iIUeBpuIt1voZsEbGn2glNhHd+g03MK++EBoKgcC2uw0pf2R2rB8g03B/pksbAf1Y0tv8itv4LlRIpcai3Ygrey28SKXBOLH7zZcSIVdz7d7DdLsOxfpzmyTnKBaAm4FMOz+FLGwLrGoTRYbCJTX0X//xAAhEQEAAgICAgIDAAAAAAAAAAABABEhMRAgQWEwUUCR8P/aAAgBAgEBPxDqO0TtFouaUzcogaXvfGWag3CWBgMW4yGXTKiyEEAw8AhoMG+Aphik4mJ5uPBdEwAzAwy1BxQSAwigXNlKL9oNl8A1CpYAQtYuAELVBMW4FUnC2yIXbC2CFX97lub4SyoAyx0S8HmMyC3mJYhGH10SymZwa7lpAiTYKIKlS6rfyJZUaKY9wx3cPBIKK+C6hANbljrqCcDUrhiINbiAuoXx4lMGbgrpJ541HChirjEa302SoPqbEsf0xCwIwHupoy+LcSAwaZgnYaQSpXxBsv8AC//EACoQAQABAwMDBAICAwEAAAAAAAERACExQVFhcYGhkbHB8BAgMNFA4fFQ/9oACAEBAAE/EP8AyhfBlPgDVdqWRsBmew8Q9ahZd0mHNDA7phUC5yOHrW/Hond6rOYDnxDUGt/advBrUXY/ibmP9RiAzSR20HXl+kRm27N8fr7gR90rke9F9ZVK3BoOhPL4+hnwDZaBzfEIhSqwrc5k+gsE6z7tUWh1OpOz1mO6iPYj+D5L4Bwt5eIbvn7BPOy+Hl0lbbgvavFA1InSYD+wPUlrdaeg6MIYnSbXSVwZhZM3Rc7LTM96aH7DEhlFNA6xOHqfPwvgvKCvLePuaGInFGPOAL+GVX1JlG3/AIgLJLbWYztDbOZOf9TaNPB0Rr2T+QDKdHW/qkQCNjp8D2s6SUige+3W5Tyf15g2n6iDZZp8LBOqcQu7vKl9WZDRCuqmD4dfOK2aYOfpLQSYG/aKY36PwSmvqUx+cC1b9yzj38ma1m5gR+pj1qlXAA8CVtUUuV0DKKmiAkAF32zMlNhdN1KugANsD3ICYW90QKKNEF0vhHqld6C6shWKjXsnlL4KsfmeGE2hKYt9lv3OJaekY/8AYLGLR5VHhU2uKGlCd1NWPbOd3RKCMy5LXLIT1TKxQfoEyelXYdg4gEBvpPE8ENU1G/lUxQHcfcn3BNX0lKMbW/lNOvAtLKNbH1OZ0nD26sDv9h1Syx1BFMz3hCZ9jk8vXx5UiZiKUIrt5T9z1uX/AOhIb9qkw15wUrH9rYvpWtVtfgfDPax7lQOe8HI2L/VizYF1z6Slq1BsWSIWrqnOZy5R284aoCpt8KiKCmnpClFo5p5QihGIzUosb94PHn6nvHvhPlr4VqVickGM/qwLCpfT9WFsP3L8bx7/AJIoS/2kEoxQO9h9ghddRfTqjhHaZQ7Rodu84c5YfqoE3TmenyDgw9jGlWtN1WZeME2wjAFbrfh7voTKwugFfIrS4l/lCnp2Ext/k3ml9yIrSoTVekupno5I2ZfANeTvAgSaMseJOiwf6RS7Cx+SNdY1gEK8JEvzn02iq8GeYVoKCYqjYyuHHEoiq/0lF7oMZ51k2RF6inNRAkNXF838imotLg5SW+qPIGLyS/EWCcQaj1LNCUTN1hpNImdL/mco2o1Ap0FH8g2O35IF32bHoRHA+u/+ZXC5sjtOCJKrZ39seO09bhZ/4lnIB5P5LAT7GNPBaO+zFb82c/yC+02G9+HNRmpNsbj/AFQoEK2v4KLSSds9oQXX0s9oT2zPaEUpXp8PbM9oQxvYBuD2MDQeU6LdKXgsv4DBbF7rnfDSqe0J7QgqFDDRU9oRGlegMKsl5VT2hPaEvcNvJ8gKuhDLNwQA9CzudD9tAjJMh+Ns6nVqoohVNgC7lgVUAMX0lRrcTqEuRVoyzctsLEDNxIaNFGxXhfavJirgHOooHSN/Z4Nk3sb7WeGEYBdldJYFQOhWrqXI5XDghgt0i7xNOlYuCRCnWXktUZQgWhRMl6phSx8gwTvn5H7TtL2Uhocdri2BGeu7P0e0/RdZ+p6wTd2wKgVZyJn7x+ZvOQZvgxG0GCGfD9p1J97/AAz+w+sv283nmc7V/mzVBzNta/aWcGtVU/U9YG4SEA4QVQbhcz93yn2n8wA0fIwmSmJm4F9ACzH7cEhLUu+sFAxQi8ECpr2qkMEwBeso4gHgdSa8yHbv5ztW4nM53qEhEgo1IG1F58LfO2RqquZwCYDiaD7ygec3v6rysIv3ExGFsOhV1CnoEdlWDcEQXrAIa7o8L2rCqEwxQFzdwjQXKatLlq1uT479/QwNsB8kQFJYz2PPZs9jy4zW6j2LPY89jxCwJyDwetrq2nsWA0AdiGUQ6Jc9jz2PA0L2yPYs5xOhXgu2ovZPZs7SSFwEAGg/8T//2Q==";


const SUPABASE_URL="https://audgtwcctdoiptuekqvn.supabase.co";
const SUPABASE_KEY="sb_publishable_oiWaymVcSB3UuhzNsO5kSg_ghVfnOwz";
async function requireAdmin(req){
 const auth=req.headers.authorization||"";if(!auth.startsWith("Bearer "))throw new Error("Authentication required.");
 const ur=await fetch(SUPABASE_URL+"/auth/v1/user",{headers:{apikey:SUPABASE_KEY,Authorization:auth}});if(!ur.ok)throw new Error("Invalid or expired session.");
 const u=await ur.json();const pr=await fetch(SUPABASE_URL+"/rest/v1/users?select=app_role,active&user_id=eq."+encodeURIComponent(u.id),{headers:{apikey:SUPABASE_KEY,Authorization:auth}});if(!pr.ok)throw new Error("Unable to verify RMS permissions.");
 const rows=await pr.json();if(rows?.[0]?.active!==true||rows?.[0]?.app_role!=="admin")throw new Error("Administrator access required for PDF reports.");return u;
}

const t=v=>String(v??"").replace(/\s+/g," ").trim();
const val=v=>t(v)||"—";
const JFD_TIME_ZONE="America/Chicago";
const centralWallIso=v=>{const s=String(v??"").trim();if(!s)return "";if(/^\\d{4}-\\d{2}-\\d{2}$/.test(s))return s;const m=s.match(/^(\\d{4}-\\d{2}-\\d{2})T(\\d{2}):(\\d{2})(?::(\\d{2}))?$/);if(!m)return "";const target=Date.UTC(Number(m[1].slice(0,4)),Number(m[1].slice(5,7))-1,Number(m[1].slice(8,10)),Number(m[2]),Number(m[3]),Number(m[4]||0));const parts=d=>{const x=new Intl.DateTimeFormat("en-US",{timeZone:JFD_TIME_ZONE,year:"numeric",month:"2-digit",day:"2-digit",hour:"2-digit",minute:"2-digit",second:"2-digit",hourCycle:"h23"}).formatToParts(new Date(d));const o={};x.forEach(p=>{if(p.type!=="literal")o[p.type]=p.value});return o};let guess=target;for(let i=0;i<3;i++){const p=parts(guess),shown=Date.UTC(+p.year,+p.month-1,+p.day,+p.hour,+p.minute,+p.second);guess+=target-shown}return new Date(guess).toISOString()};
const centralDateParts=v=>{if(!v)return null;const s=String(v).trim();const wall=s.match(/^(\\d{4}-\\d{2}-\\d{2})(?:T\\d{2}:\\d{2}(?::\\d{2})?)?$/);if(wall){const p=wall[1].split("-");return {year:p[0],month:p[1],day:p[2]}}const d=new Date(s);if(Number.isNaN(d.getTime()))return null;const parts=new Intl.DateTimeFormat("en-US",{timeZone:JFD_TIME_ZONE,year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(d),o={};parts.forEach(p=>{if(p.type!=="literal")o[p.type]=p.value});return o};
const centralTimeParts=v=>{if(!v)return null;const s=String(v).trim();const wall=s.match(/^\\d{4}-\\d{2}-\\d{2}T(\\d{2}):(\\d{2})(?::(\\d{2}))?$/);if(wall)return {hour:wall[1],minute:wall[2]};const d=new Date(s);if(Number.isNaN(d.getTime()))return null;const parts=new Intl.DateTimeFormat("en-US",{timeZone:JFD_TIME_ZONE,hour:"2-digit",minute:"2-digit",hourCycle:"h23"}).formatToParts(d),o={};parts.forEach(p=>{if(p.type!=="literal")o[p.type]=p.value});return o};
const date=v=>{const p=centralDateParts(v);return p?p.month+"/"+p.day+"/"+p.year:String(v??"")};
const time=v=>{const p=centralTimeParts(v);return p?p.hour+":"+p.minute:String(v??"")};

export async function makePdf(incident={},reports=[]){
 const pdf=await PDFDocument.create();
 const reg=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 const F={reg,bold},W=612,H=792,m=42,usable=W-2*m;
 const jfdLogo=await pdf.embedJpg(Buffer.from(JFD_LOGO_BASE64,"base64"));
 let page,y;
 const newPage=()=>{page=pdf.addPage([W,H]);y=H-m};
 const need=n=>{if(y<58+n)newPage()};
 const wrap=(s,size=8,lh=11,b=false)=>{const font=b?F.bold:F.reg,words=String(s??"").split(/\s+/),w=usable;let line="";for(const word of words){const next=line?line+" "+word:word;if(font.widthOfTextAtSize(next,size)>w&&line){page.drawText(line,{x:m,y,font,size,color:rgb(.1,.15,.2)});y-=lh;line=word}else line=next}if(line){page.drawText(line,{x:m,y,font,size,color:rgb(.1,.15,.2)});y-=lh}};
 const heading=s=>{need(34);page.drawText(s,{x:m,y,font:F.bold,size:11,color:rgb(.12,.18,.25)});y-=16};
 const line=(label,v)=>{need(20);page.drawText(String(label),{x:m,y,font:F.bold,size:8,color:rgb(.12,.18,.25)});wrap(val(v),8,10,false)};
 const kv=(label,v)=>line(label,v);
 const top=(title,subtitle="")=>{newPage();page.drawRectangle({x:m,y:y-66,width:usable,height:66,borderWidth:1,borderColor:rgb(.78,.82,.87),color:rgb(1,1,1)});page.drawImage(jfdLogo,{x:m+4,y:y-62,width:102,height:62});page.drawText("JASPER FIRE DEPARTMENT",{x:m+118,y:y-20,font:F.bold,size:15,color:rgb(.12,.16,.22)});page.drawText("10 18th Street East · Jasper, Alabama 35501 · 205-221-8509",{x:m+118,y:y-34,font:F.reg,size:7.5,color:rgb(.3,.35,.4)});page.drawText(title,{x:m+118,y:y-49,font:F.bold,size:10,color:rgb(.65,.02,.02)});y-=78;if(subtitle)wrap(subtitle,8,11);y-=3;};
 const fire=(reports||[]).filter(r=>String(r?.report_type||"").startsWith("fire_"));
 const pcr=(reports||[]).filter(r=>String(r?.report_type||"").startsWith("pcr_"));
 const fd=fire[0]?.data||{};
 const patients=pcr.flatMap(r=>Array.isArray(r?.data?.patients)?r.data.patients:[]);

 // PAGE 1: actual report-facing/basic information, not technical NERIS detail.
 top("FIRE INCIDENT REPORT","Front page of the JFD paper Fire Incident Report.");
 heading("INCIDENT INFORMATION");
 kv("CAD / Incident Number",incident.cad||fd.rCad);
 kv("Incident Date",date(fd.rDate||incident.dispatch_time));
 kv("Call Type",fd.rCall||fd.rCallType||incident.type);
 kv("Primary Incident Type",fd.rPrimaryIncidentType||incident.type);
 kv("Secondary Incident Type",fd.rSecondaryIncidentType);
 kv("Incident Location",fd.rLocation||incident.location);
 kv("Location Type",fd.rLocationType);
 kv("Shift",fd.rShift);
 heading("PERSON / PROPERTY");
 kv("Person Involved",fd.rPerson||fd.person_involved);
 kv("Owner Name",fd.rOwnerName||fd.owner_name);
 kv("Owner Address",fd.rOwnerAddress||fd.owner_address);
 kv("Owner Phone",fd.rOwnerPhone||fd.owner_phone);
 kv("Occupant Name",fd.rOccupantName||fd.rOccName||fd.occupant_name);
 kv("Occupant Address",fd.rOccupantAddress||fd.occupant_address);
 kv("Occupant Phone",fd.rOccupantPhone||fd.rOccPhone||fd.occupant_phone);
 kv("Property Use / Occupancy",fd.rPrimaryUse||fd.rOccupancy);
 kv("Location In Use",fd.rLocationInUse);
 kv("Used As Intended",fd.rUsedAsIntended);
 heading("INSURANCE / LOSS");
 kv("Insurance Company",fd.rInsuranceCompany||fd.rOwnerInsurance||fd.rOccInsurance||fd.insurance_company);
 kv("Insurance Phone",fd.rInsurancePhone||fd.insurance_phone);
 kv("Policy Number",fd.rInsurancePolicy||fd.insurance_policy);
 kv("Damage Type",fd.rDamageType||fd.damage_type);
 kv("Estimated Damage",fd.rDamageEstimate||fd.damage_estimate);
 const vehicles=Array.isArray(fd.vehicles)?fd.vehicles:[];
 if(vehicles.length){heading("VEHICLE / PROPERTY INVOLVED");vehicles.forEach((v,i)=>{kv("Vehicle #"+(i+1),[v.year,v.make,v.model,v.vehicle,v.description].filter(Boolean).join(" "));kv("Owner",v.owner);kv("Insurance",v.insurance);kv("License / VIN",v.vin||v.license||v.license_vin)})}
 else {heading("VEHICLE / PROPERTY INVOLVED");kv("Vehicle #1",fd.rVehicle1);kv("Year",fd.rYear1);kv("Make",fd.rMake1);kv("Model",fd.rModel1);kv("License / VIN",fd.rVin1)}
 heading("INCIDENT ACTION / RESPONSE");
 kv("Action Taken",fd.rActionTaken||fd.action_taken);
 kv("No Action Taken",fd.rNoActionTaken||fd.no_action_taken);
 kv("Actions / Tactics",Array.isArray(fd.actions_taken)?fd.actions_taken.join(", "):fd.rActionsTaken);
 kv("Water Supply",fd.rWater||fd.water_supply);
 kv("Investigation",fd.rInvestigation||fd.investigation);
 kv("Fire Location",fd.rFireLoc||fd.fire_location);
 kv("Floor / Room", [fd.rFloor||fd.floor_of_origin,fd.rRoom||fd.room_type].filter(Boolean).join(" / "));
 kv("Condition",fd.rCondition||fd.condition);
 kv("Cause",fd.rCause||fd.cause);
 kv("Alarms / Suppression", [fd.rFireAlarm,fd.rOtherAlarm,fd.rSuppression,fd.rCookingSuppression].filter(Boolean).join(" / "));
 kv("Exposures",Array.isArray(fd.exposures)?fd.exposures.map(x=>typeof x==="object"?JSON.stringify(x):x).join("; "):fd.exposures);
 kv("Casualties / Rescues",Array.isArray(fd.casualties)?fd.casualties.map(x=>typeof x==="object"?JSON.stringify(x):x).join("; "):fd.casualties);
 kv("Hazards / HAZMAT",Array.isArray(fd.hazards)?fd.hazards.map(x=>typeof x==="object"?JSON.stringify(x):x).join("; "):fd.hazards||fd.rHazmat);
 heading("NARRATIVE");
 wrap(fd.rNarrative||incident.narrative||"No narrative entered.",9,13);
 kv("Person Completing Report",fd.rCompletedBy||fd.completedBy||fd.report_completed_by);
 page.drawText("JFD RMS • Fire Incident Report • Page 1",{x:m,y:38,font:F.reg,size:7,color:rgb(.4,.4,.4)});

 // Technical fire record.
 for(const [idx,r] of fire.entries()){
   const d=r?.data||{};
   top("TECHNICAL INCIDENT RECORD","Department operational detail. Public/property information remains on Page 1.");
   heading("INCIDENT / LOCATION");
   ["rCad","rDate","rShift","rCall","rCallType","rPrimaryIncidentType","rSecondaryIncidentType","rLocation","rLatitude","rLongitude","rLocationType","rPrimaryUse","rSecondaryUse","rLocationInUse","rUsedAsIntended","rVacancy","rPeoplePresent"].forEach(k=>kv(k.replace(/^r/,"").replace(/([A-Z])/g," $1"),d[k]||(k==="rCad"?incident.cad:k==="rLocation"?incident.location:"")));
   heading("DISPATCH / RESPONSE");
   kv("Dispatch Incident Number",d.rDispatchIncidentNumber);
   kv("Call Arrival",d.rCallArrival);kv("Call Answered",d.rCallAnswered);kv("Call Create",d.rCallCreate);kv("Dispatch Time",d.rDispatch);
   const units=Array.isArray(d.responding_apparatus)?d.responding_apparatus:[];
   if(units.length)units.forEach(u=>{const z=u.times||{};kv("Apparatus",u.unit_number||u.unit);kv("Crew",Array.isArray(u.crew)?u.crew.map(x=>typeof x==="object"?x.name:x).join(", "):u.crew);kv("En Route",z.enroute);kv("On Scene",z.on_scene);kv("Cancelled",z.cancelled);kv("In Service",z.in_service||z.clear)});
   else kv("Responding Apparatus","None recorded");
   kv("Additional Personnel",Array.isArray(d.additional_personnel)?d.additional_personnel.join(", "):d.additional_personnel);
   heading("FIRE / INCIDENT CONDITIONS");
   ["rFireLoc","rCondition","rWater","rDamageType","rDamageEstimate","rFloor","rRoom","rCause","rAcres","rSmokePresence","rSmokeWorking","rFireAlarm","rOtherAlarm","rSuppression","rCookingSuppression"].forEach(k=>kv(k.replace(/^r/,"").replace(/([A-Z])/g," $1"),d[k]));
   heading("ACTIONS / TACTICS");
   kv("Action Taken",d.rActionTaken||d.action_taken);kv("No Action Taken",d.rNoActionTaken||d.no_action_taken);
   kv("Actions / Tactics",Array.isArray(d.actions_taken)?d.actions_taken.join(", "):d.rActionsTaken);
   heading("EXPOSURES / CASUALTIES / HAZARDS");
   for(const [label,key] of [["Exposure","exposures"],["Casualty / Rescue","casualties"],["Hazard","hazards"]]){const arr=Array.isArray(d[key])?d[key]:[];if(arr.length)arr.forEach(x=>wrap(label+": "+JSON.stringify(x),8,11,true));else kv(label+"s","None recorded")}
   heading("MUTUAL AID / OTHER AGENCIES");
   const aids=[...(Array.isArray(d.aid_records)?d.aid_records:[]),...(Array.isArray(d.nonfd_aid_records)?d.nonfd_aid_records:[])];
   if(aids.length)aids.forEach(x=>wrap(JSON.stringify(x),8,11));else kv("Aid","None recorded");
   heading("HAZMAT / SPECIAL HAZARDS");
   ["rEvac","rHazEvacuated","rHazmat","rHazDisposition","rChemicals","rChemicalName","rChemicalClass","rChemicalRelease","rElectrical","rOtherHazard"].forEach(k=>kv(k.replace(/^r/,"").replace(/([A-Z])/g," $1"),d[k]));
   heading("NARRATIVE / COMPLETION");wrap(d.rNarrative||"No narrative entered.",9,13);kv("Report Completed By",d.rCompletedBy);
 }

 // Every patient gets a separate page group. No other patient's information is placed on that group.
 for(let i=0;i<patients.length;i++){
   const p=patients[i]||{};
   top("PATIENT CARE REPORT","Patient "+(i+1)+" of "+patients.length+" • Complete JFD Patient Care Report. This report is for this patient only.");
   heading("PATIENT INFORMATION");
   kv("Patient Name",p.name);kv("Date of Birth",date(p.dob));kv("Age",p.age);kv("Sex",p.sex);kv("Patient Address",p.address);kv("Patient Phone",p.phone);
   kv("Incident / CAD",incident.cad||fd.rCad);kv("Incident Date",date(fd.rDate||incident.dispatch_time));kv("Incident Time",time(fd.rDateTime||fd.rDispatch||incident.dispatch_time));kv("Incident Location",fd.rLocation||incident.location);
   kv("Responding Unit",p.vehicle||p.assignedVehicle||p.unit||fd.responding_unit);
   heading("CHIEF COMPLAINT / PRESENTATION");
   kv("Chief Complaint / Reason for Response",p.chief);kv("Injury / Medical Complaint",p.injury||p.complaint);kv("Presentation / Brief Narrative",p.presentation||p.narrative);
   heading("ASSESSMENT / CARE");
   kv("Patient Care Provided",p.careProvided===true?"Yes":p.careProvided===false?"No":p.evaluation);
   const vitals=p.vitals||{};
   if(Object.keys(vitals).length)for(const [k,v] of Object.entries(vitals))if(v!==undefined&&v!==null&&v!=="")kv(k.replace(/[_-]+/g," ").replace(/\b\w/g,c=>c.toUpperCase()),v);
   const care=Array.isArray(p.methodsOfCare)?p.methodsOfCare:Array.isArray(p.careMethods)?p.careMethods:Array.isArray(p.methods)?p.methods:[];
   if(care.length)kv("BLS Methods of Care",care.join(", "));
   kv("Oxygen",p.oxygen||p.oxygenMethod);
   kv("Medical History",p.medicalHistory||p.history);
   kv("Medications",p.medications||p.meds);
   kv("Allergies",p.allergies);
   heading("DISPOSITION");
   kv("Disposition",p.transportDisposition||p.transport||p.disposition);
   kv("Transporting Agency / Unit",p.transportAgency||p.transportUnit||p.vehicle);
   kv("Destination",p.destination);
   kv("Disposition Narrative",p.dispositionNarrative);
   kv("Vehicle / Insurance",p.vehicleInfo||p.vehicleInsurance||p.insurance);
   kv("Equipment Used / Replaced",p.equipmentUsed||p.equipmentReplaced||p.equipment);
   if(p.refusedCare||p.refusedTransport||p.minorRefusal){
     heading("REFUSAL / SIGNATURES");
     kv("Refusal Type",[p.refusedCare?"Refused Care":"",p.refusedTransport?"Refused Transport":"",""].filter(Boolean).join(", ")||"Minor refusal");
     kv("Patient / Guardian Name",p.refusalSigner);
     kv("Guardian Relationship",p.guardianRelationship);
     kv("Risks Explained / Acknowledged",p.risksExplained||p.risksAcknowledged);
     kv("Refusal Date / Time",p.refusalDateTime||p.refusalDate||p.signedAt);
     kv("Provider",p.provider||"JFD RMS user / electronic record");
     kv("Minor Patients",Array.isArray(p.minorPatients)?p.minorPatients.map(x=>x.name+" (DOB "+x.dob+")").join(", "):"");
     const sigs=[["Patient / Guardian Signature",p.signature]];
     for(const [label,dataUrl] of sigs){if(!String(dataUrl||"").startsWith("data:image/png"))continue;try{const bytes=Buffer.from(String(dataUrl).split(",")[1],"base64");const img=await pdf.embedPng(bytes);need(105);page.drawText(label,{x:m,y,font:F.bold,size:8});y-=12;page.drawImage(img,{x:m,y:y-70,width:250,height:70});page.drawRectangle({x:m,y:y-70,width:250,height:70,borderWidth:.5,borderColor:rgb(.6,.6,.6)});y-=82}catch{}}
   }
   heading("NARRATIVE");
   wrap(p.narrative||p.comments||"No narrative entered.",9,13);
   kv("Person Completing Report",p.completedBy||p.reportCompletedBy||p.provider||"JFD RMS user / electronic record");
   page.drawText("JFD RMS • Patient Care Report • Patient "+(i+1)+" of "+patients.length,{x:m,y:38,font:F.reg,size:7,color:rgb(.4,.4,.4)});
 }
 if(!patients.length){top("PATIENT CARE REPORT","No patient records were attached to this incident.");kv("Patient Records","None recorded");}

 // NERIS investigation is always the final section.
 top("NERIS INVESTIGATION DETAILS","Final technical section. This section is kept separate from the public/basic front-page information.");
 for(const r of fire){
   const d=r?.data||{};
   heading("INVESTIGATION");
   [["Investigation Required",d.rInvestigation],["Investigation Type",d.rInvestigationType],["Cause",d.rCause||d.cause],["Origin Floor",d.rFloor||d.floor_of_origin],["Origin Room / Area",d.rRoom||d.room_type],["Arrival Condition",d.rCondition||d.condition],["Damage Type",d.rDamageType||d.damage_type],["Damage Estimate",d.rDamageEstimate||d.damage_estimate],["Fire Location",d.rFireLoc||d.fire_location],["Water Supply",d.rWater||d.water_supply],["Smoke Alarm Presence",d.rSmokePresence||d.smoke_alarm_presence],["Smoke Alarm Working",d.rSmokeWorking||d.smoke_alarm_working],["Fire Alarm",d.rFireAlarm||d.fire_alarm],["Other Alarm",d.rOtherAlarm||d.other_alarm],["Suppression System",d.rSuppression||d.suppression_system],["Cooking Fire Suppression",d.rCookingSuppression||d.cooking_suppression]].forEach(([k,v])=>kv(k,v));
   const n=d.neris_investigation||d.nerisInvestigation||d.investigation_details||d.neris?.investigation;
   if(n&&typeof n==="object"){heading("NERIS INVESTIGATION RECORD");for(const [k,v] of Object.entries(n)){if(v===undefined||v===null||v==="")continue;wrap(k.replace(/[_-]+/g," ").replace(/\b\w/g,c=>c.toUpperCase())+": "+(typeof v==="object"?JSON.stringify(v):v),8,11,true)}}
 }
 if(!fire.length)kv("NERIS Investigation","No Fire Incident Report investigation data attached.");
 page.drawText("JFD RMS • NERIS Investigation Details • Final Section",{x:m,y:38,font:F.reg,size:7,color:rgb(.4,.4,.4)});
 return pdf.save();
}

async function makeArchivePdf(kind,data){
 const pdf=await PDFDocument.create(),reg=await pdf.embedFont(StandardFonts.Helvetica),bold=await pdf.embedFont(StandardFonts.HelveticaBold);
 const W=612,H=792,m=42,usable=W-2*m;let page,y;const F={reg,bold};const newPage=()=>{page=pdf.addPage([W,H]);y=H-m};const wrap=(s,size=9,lh=13,b=false)=>{const font=b?F.bold:F.reg;let line="";for(const word of String(s??"").split(/\s+/)){const n=line?line+" "+word:word;if(font.widthOfTextAtSize(n,size)>usable&&line){page.drawText(line,{x:m,y,font,size});y-=lh;line=word}else line=n}if(line){page.drawText(line,{x:m,y,font,size});y-=lh}};const top=title=>{newPage();page.drawText("JASPER FIRE DEPARTMENT",{x:m,y,font:F.bold,size:16,color:rgb(.12,.16,.22)});y-=20;page.drawText(title,{x:m,y,font:F.bold,size:11,color:rgb(.65,.02,.02)});y-=24};const section=title=>{if(y<80)newPage();page.drawText(title,{x:m,y,font:F.bold,size:11});y-=17};const kv=(k,v)=>{if(y<55)newPage();page.drawText(k+":",{x:m,y,font:F.bold,size:8});wrap(v||"—",8,10);};
 top(kind==="staffing"?"DAILY STAFFING REPORT":kind==="check"?"APPARATUS CHECK REPORT":kind==="inspection"?"FIRE INSPECTION REPORT":"INCIDENT REPORT");
 const x=data||{};for(const [k,v] of Object.entries(x)){if(v===null||v===undefined||v==="")continue;if(Array.isArray(v)||typeof v==="object"){section(k.replace(/[_-]/g," ").toUpperCase());wrap(JSON.stringify(v,null,2),7,9)}else kv(k.replace(/[_-]/g," "),v)}
 if(kind==="incident"&&x.reports){for(const r of x.reports||[]){section(r.report_type||"Report");for(const [k,v] of Object.entries(r.data||{})){if(v===null||v===undefined||v==="")continue;if(Array.isArray(v)||typeof v==="object")wrap(k+": "+JSON.stringify(v),7,9);else kv(k,v)}}}
 page.drawText("JFD RMS • Administrative Report Archive",{x:m,y:30,font:F.reg,size:7,color:rgb(.4,.4,.4)});return pdf.save();
}
export default async function handler(req,res){
 if(req.method!=="POST")return res.status(405).json({ok:false,error:"Method not allowed"});
 try{
  const body=typeof req.body==="string"?JSON.parse(req.body):req.body||{};
  if(body.archiveType){
    const pdf=await makeArchivePdf(body.archiveType,body.archiveData||{});
    if(body.action==="email"){
      const key=String(process.env.BREVO_API_KEY||""),from=String(process.env.BREVO_FROM_EMAIL||"");
      if(!key||!from)return res.status(503).json({ok:false,error:"Report email is not configured in Vercel."});
      const b64=Buffer.from(pdf).toString("base64"),name="JFD "+String(body.archiveType||"report")+" report.pdf";
      const er=await fetch("https://api.brevo.com/v3/smtp/email",{method:"POST",headers:{"api-key":key,"Content-Type":"application/json","accept":"application/json"},body:JSON.stringify({sender:{email:from,name:"Jasper Fire Department"},to:[{email:"firechief@jaspercity.com"}],subject:"JFD "+String(body.archiveType||"Report")+" Report",textContent:"Attached is a Jasper Fire Department report generated by JFD RMS.",attachment:[{content:b64,name}]})});
      if(!er.ok)return res.status(502).json({ok:false,error:"Report email failed."});return res.status(200).json({ok:true});
    }
    res.setHeader("Content-Type","application/pdf");res.setHeader("Content-Disposition",'attachment; filename="JFD Administrative Report.pdf"');return res.status(200).send(Buffer.from(pdf));
  }
  const pdf=await makePdf(body.incident||{},Array.isArray(body.reports)?body.reports:[]);
  if(body.action==="email"){
    const key=String(process.env.BREVO_API_KEY||""),from=String(process.env.BREVO_FROM_EMAIL||"");
    const to=Array.isArray(body.to)?body.to.filter(Boolean):body.to?[body.to]:["firechief@jaspercity.com"];
    if(!key||!from)return res.status(503).json({ok:false,error:"Report email is not configured in Vercel."});
    const b64=Buffer.from(pdf).toString("base64");
    const subject="Jasper Fire Department Incident Report"+(body.incident?.cad?" - "+body.incident.cad:"");
    const er=await fetch("https://api.brevo.com/v3/smtp/email",{method:"POST",headers:{"api-key":key,"Content-Type":"application/json","accept":"application/json"},body:JSON.stringify({sender:{email:from,name:"Jasper Fire Department"},to:to.map(email=>({email})),subject,textContent:"Attached is the Jasper Fire Department incident report generated by JFD RMS.",attachment:[{content:b64,name:(body.incident?.cad||"incident")+" - JFD Report.pdf"}]})});
    const et=await er.text();let ed;try{ed=JSON.parse(et)}catch{ed={raw:et}};
    if(!er.ok)return res.status(502).json({ok:false,error:"Report email failed.",details:ed});
    return res.status(200).json({ok:true,email_id:ed?.messageId||null});
  }
  res.setHeader("Content-Type","application/pdf");res.setHeader("Content-Disposition",'inline; filename="JFD Incident Report.pdf"');
  return res.status(200).send(Buffer.from(pdf));
 }
 catch(e){console.error("JFD report PDF error",e);return res.status(500).json({ok:false,error:e?.message||"Report generation failed"})}
}